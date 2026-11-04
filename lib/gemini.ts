import 'server-only'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Give up on one model call after this long and try the next model.
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 25_000

export type GeminiImage = { mime: string; base64: string }

export type GeminiResult = {
  text: string
  inputTokens: number | null
  outputTokens: number | null
  finishReason: string | null
}

/** Download an image once so every step that needs it can reuse it. */
export async function loadImage(url: string): Promise<GeminiImage> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Couldn't download the image (${res.status}).`)
  const mime = res.headers.get('content-type')?.split(';')[0] ?? ''
  if (!mime.startsWith('image/')) throw new Error("That URL doesn't point to an image.")
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Image is larger than 8 MB.')
  return { mime, base64: bytes.toString('base64') }
}

/**
 * One Gemini call. Tries each model in `models` in order: retries a busy model
 * (429 / 503) a few times, then falls back to the next model in the list.
 */
export async function callGemini(opts: {
  models: string[]
  system?: string | null
  prompt: string
  temperature?: number | null
  image?: GeminiImage | null
}): Promise<GeminiResult & { model: string }> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set for this app.')

  const parts: object[] = [{ text: opts.prompt }]
  if (opts.image) parts.push({ inline_data: { mime_type: opts.image.mime, data: opts.image.base64 } })

  const body = JSON.stringify({
    ...(opts.system?.trim() ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    contents: [{ role: 'user', parts }],
    ...(opts.temperature != null ? { generationConfig: { temperature: Number(opts.temperature) } } : {}),
  })

  let lastError = 'Gemini did not respond.'
  let wasBusy = false

  for (const model of opts.models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let res: Response
      let data: any
      try {
        res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
              body,
              signal: AbortSignal.timeout(TIMEOUT_MS),
            }
        )
        data = await res.json()
      } catch (e) {
        const name = e instanceof Error ? e.name : ''
        if (name === 'TimeoutError' || name === 'AbortError') {
          console.error(`[gemini] ${model} timed out after ${TIMEOUT_MS / 1000}s`)
          wasBusy = true
          lastError = `${model} took longer than ${TIMEOUT_MS / 1000} s.`
          break // a slow model: go straight to the next one instead of waiting again
        }
        throw e
      }

      if (res.ok) {
        const cand = data.candidates?.[0]
        const text = (cand?.content?.parts ?? [])
            .map((p: { text?: string }) => p.text ?? '')
            .join('')
            .trim()
        if (!text) {
          const why = cand?.finishReason ?? data.promptFeedback?.blockReason
          throw new Error(`Gemini returned no text${why ? ` (${why})` : ''}.`)
        }
        return {
          text,
          model,
          inputTokens: data.usageMetadata?.promptTokenCount ?? null,
          outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
          finishReason: cand?.finishReason ?? null,
        }
      }

      const msg = data.error?.message ?? `Gemini error ${res.status}`
      console.error(`[gemini] ${model} attempt ${attempt + 1} (${res.status}):`, msg)

      if (res.status === 429 || res.status === 503 || res.status === 500) {
        wasBusy = true
        lastError = msg
        await sleep(800 * 2 ** attempt) // 0.8 s, 1.6 s, 3.2 s
        continue
      }
      if (res.status === 404) {
        // A missing backup model shouldn't hide the real "busy" problem.
        if (!wasBusy) lastError = `Model "${model}" wasn't found. Check its API model ID in the admin panel.`
        break // try the next model
      }
      throw new Error(msg) // bad key, bad request, etc.: another model won't help
    }
  }

  throw new Error(
      wasBusy
          ? `Every model tried (${opts.models.join(', ')}) is busy right now. Wait a minute and run again.`
          : lastError
  )
}