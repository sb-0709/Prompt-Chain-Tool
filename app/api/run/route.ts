import { checkAdmin } from '@/lib/auth'
import { callGemini, loadImage, type GeminiImage } from '@/lib/gemini'
import { checkStep, render } from '@/lib/templates'
import type { Step } from '@/lib/types'

// A multi-step chain can take a while; give it room on Vercel.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const DEFAULT_MODEL = process.env.GEMINI_DEFAULT_MODEL || 'gemini-3.8-flash'

type StepRow = Step & { llm_models: { model_id: string; name: string } | null }

/**
 * POST { chainId, imageUrl?, userPrompt? }
 * Streams newline-delimited JSON events so the page can show each step as it finishes:
 *   {type:'start', requestId, steps:[{order,name,model}]}
 *   {type:'step-start', order}
 *   {type:'step', order, text, ms, inputTokens, outputTokens}
 *   {type:'done', requestId, output, ms}
 *   {type:'error', order?, message}
 */
export async function POST(request: Request) {
  const auth = await checkAdmin()
  if ('error' in auth) return Response.json({ error: auth.error }, { status: auth.status })
  const { supabase, user } = auth

  const body = await request.json().catch(() => ({}))
  const chainId = Number(body.chainId)
  const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null
  const userPrompt = typeof body.userPrompt === 'string' ? body.userPrompt.trim() : ''

  if (!Number.isInteger(chainId)) return Response.json({ error: 'Pick a chain.' }, { status: 400 })
  if (imageUrl && !/^https?:\/\//i.test(imageUrl))
    return Response.json({ error: 'The image link must start with http:// or https://.' }, { status: 400 })

  const { data: rows, error } = await supabase
    .from('prompt_chain_steps')
    .select('*, llm_models(model_id, name)')
    .eq('chain_id', chainId)
    .order('step_order')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const steps = (rows ?? []) as StepRow[]
  if (steps.length === 0) return Response.json({ error: 'This chain has no steps yet. Add one first.' }, { status: 400 })

  const blocking = steps.flatMap((s, i) =>
    checkStep([s.system_prompt, s.user_prompt_template], i + 1, steps.length)
      .filter((p) => p.includes('runs after'))
      .map((p) => `Step ${i + 1}: ${p}`)
  )
  if (blocking.length) return Response.json({ error: blocking.join(' ') }, { status: 400 })

  const needsImage = steps.some((s) => s.include_image)
  if (needsImage && !imageUrl)
    return Response.json(
      { error: 'A step in this chain is set to see the image. Add an image first.' },
      { status: 400 }
    )

  const { data: req, error: reqErr } = await supabase
    .from('generation_requests')
    .insert({
      user_id: user.id,
      source: 'admin',
      chain_id: chainId,
      model_id: steps[0].model_id,
      image_url: imageUrl,
      prompt: userPrompt || null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (reqErr) return Response.json({ error: `Couldn't log the run: ${reqErr.message}` }, { status: 500 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      const started = Date.now()
      const outputs: string[] = []
      let current = 0

      send({
        type: 'start',
        requestId: req.id,
        steps: steps.map((s, i) => ({
          order: i + 1,
          name: s.name,
          model: s.llm_models?.name ?? DEFAULT_MODEL,
        })),
      })

      try {
        let image: GeminiImage | null = null
        if (needsImage && imageUrl) image = await loadImage(imageUrl)

        for (const [i, s] of steps.entries()) {
          current = i + 1
          send({ type: 'step-start', order: current })
          const t0 = Date.now()
          const ctx = { userPrompt, outputs }
          const result = await callGemini({
            model: s.llm_models?.model_id ?? DEFAULT_MODEL,
            system: s.system_prompt ? render(s.system_prompt, ctx) : null,
            prompt: render(s.user_prompt_template, ctx),
            temperature: s.temperature,
            image: s.include_image ? image : null,
          })
          outputs.push(result.text)

          await supabase.from('llm_responses').insert({
            request_id: req.id,
            model_id: s.model_id,
            step_order: current,
            response_text: result.text,
            input_tokens: result.inputTokens,
            output_tokens: result.outputTokens,
            finish_reason: result.finishReason,
          })

          send({
            type: 'step',
            order: current,
            text: result.text,
            ms: Date.now() - t0,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          })
        }

        const ms = Date.now() - started
        await supabase
          .from('generation_requests')
          .update({ status: 'success', latency_ms: ms })
          .eq('id', req.id)
        send({ type: 'done', requestId: req.id, output: outputs[outputs.length - 1], ms })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'The run failed.'
        await supabase
          .from('generation_requests')
          .update({
            status: 'error',
            error_message: current ? `Step ${current}: ${message}` : message,
            latency_ms: Date.now() - started,
          })
          .eq('id', req.id)
        send({ type: 'error', order: current || undefined, message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
