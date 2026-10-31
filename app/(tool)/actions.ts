'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { remapSteps } from '@/lib/templates'

type Result = { error?: string }

const friendly = (msg: string) =>
  /duplicate key.*prompt_chains_name/i.test(msg) ? 'A chain with that name already exists.' : msg

// ---------------------------------------------------------------- chains

export async function createChain(_: Result | undefined, form: FormData): Promise<Result> {
  const { supabase } = await requireAdmin()
  const name = String(form.get('name') ?? '').trim()
  const description = String(form.get('description') ?? '').trim() || null
  if (!name) return { error: 'Give the chain a name.' }

  const { data, error } = await supabase
    .from('prompt_chains')
    .insert({ name, description })
    .select('id')
    .single()
  if (error) return { error: friendly(error.message) }

  revalidatePath('/')
  redirect(`/chains/${data.id}`)
}

export async function updateChain(
  id: number,
  values: { name?: string; description?: string | null; is_active?: boolean }
): Promise<Result> {
  const { supabase } = await requireAdmin()
  if (values.name !== undefined && !values.name.trim()) return { error: 'Give the chain a name.' }
  const { error } = await supabase
    .from('prompt_chains')
    .update({
      ...values,
      ...(values.name !== undefined ? { name: values.name.trim() } : {}),
      ...(values.description !== undefined ? { description: values.description?.trim() || null } : {}),
    })
    .eq('id', id)
  if (error) return { error: friendly(error.message) }
  revalidatePath('/')
  revalidatePath(`/chains/${id}`, 'layout')
  return {}
}

export async function deleteChain(id: number): Promise<Result> {
  const { supabase } = await requireAdmin()
  // Steps go with it (on delete cascade). Past runs and published captions
  // stay, with their chain link set to null.
  const { error } = await supabase.from('prompt_chains').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  redirect('/')
}

export async function duplicateChain(id: number): Promise<Result> {
  const { supabase } = await requireAdmin()
  const [{ data: chain }, { data: steps }] = await Promise.all([
    supabase.from('prompt_chains').select('name, description').eq('id', id).single(),
    supabase.from('prompt_chain_steps').select('*').eq('chain_id', id).order('step_order'),
  ])
  if (!chain) return { error: "That chain doesn't exist anymore." }

  let name = `${chain.name} (copy)`
  for (let i = 2; i < 50; i++) {
    const { count } = await supabase
      .from('prompt_chains')
      .select('id', { count: 'exact', head: true })
      .eq('name', name)
    if (!count) break
    name = `${chain.name} (copy ${i})`
  }

  const { data: copy, error } = await supabase
    .from('prompt_chains')
    .insert({ name, description: chain.description, is_active: false })
    .select('id')
    .single()
  if (error) return { error: friendly(error.message) }

  if (steps?.length) {
    const { error: stepErr } = await supabase.from('prompt_chain_steps').insert(
      steps.map((s) => ({
        chain_id: copy.id,
        step_order: s.step_order,
        name: s.name,
        model_id: s.model_id,
        system_prompt: s.system_prompt,
        user_prompt_template: s.user_prompt_template,
        temperature: s.temperature,
        include_image: s.include_image,
      }))
    )
    if (stepErr) return { error: stepErr.message }
  }

  revalidatePath('/')
  redirect(`/chains/${copy.id}`)
}

// ---------------------------------------------------------------- steps

export type StepInput = {
  name: string
  model_id: number | null
  system_prompt: string
  user_prompt_template: string
  temperature: number | null
  include_image: boolean
}

function cleanStep(v: StepInput): { values?: Omit<StepInput, never>; error?: string } {
  const name = v.name.trim()
  const tpl = v.user_prompt_template.trim()
  if (!name) return { error: 'Give the step a name.' }
  if (!tpl) return { error: 'Write the prompt for this step.' }
  if (v.temperature != null && (Number.isNaN(v.temperature) || v.temperature < 0 || v.temperature > 2))
    return { error: 'Temperature must be between 0 and 2.' }
  return {
    values: {
      name,
      model_id: v.model_id,
      system_prompt: v.system_prompt.trim(),
      user_prompt_template: tpl,
      temperature: v.temperature,
      include_image: v.include_image,
    },
  }
}

export async function createStep(chainId: number, input: StepInput): Promise<Result> {
  const { supabase } = await requireAdmin()
  const { values, error } = cleanStep(input)
  if (error) return { error }

  const { data: last } = await supabase
    .from('prompt_chain_steps')
    .select('step_order')
    .eq('chain_id', chainId)
    .order('step_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error: insErr } = await supabase.from('prompt_chain_steps').insert({
    ...values,
    system_prompt: values!.system_prompt || null,
    chain_id: chainId,
    step_order: (last?.step_order ?? 0) + 1,
  })
  if (insErr) return { error: insErr.message }
  revalidatePath(`/chains/${chainId}`, 'layout')
  revalidatePath('/')
  return {}
}

export async function updateStep(stepId: number, input: StepInput): Promise<Result> {
  const { supabase } = await requireAdmin()
  const { values, error } = cleanStep(input)
  if (error) return { error }

  const { data, error: upErr } = await supabase
    .from('prompt_chain_steps')
    .update({ ...values, system_prompt: values!.system_prompt || null })
    .eq('id', stepId)
    .select('chain_id')
    .single()
  if (upErr) return { error: upErr.message }
  revalidatePath(`/chains/${data.chain_id}`, 'layout')
  return {}
}

/** Save a new order. ids = every step id of the chain, in the new order. */
async function applyOrder(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  chainId: number,
  ids: number[],
  map: Map<number, number | null>
): Promise<Result> {
  const { data: steps, error } = await supabase
    .from('prompt_chain_steps')
    .select('id, system_prompt, user_prompt_template')
    .eq('chain_id', chainId)
  if (error) return { error: error.message }
  const byId = new Map(steps.map((s) => [s.id, s]))
  if (ids.length !== steps.length || ids.some((id) => !byId.has(id)))
    return { error: 'The steps changed somewhere else. Refresh the page and try again.' }

  const { error: rpcErr } = await supabase.rpc('reorder_chain_steps', {
    p_chain_id: chainId,
    p_step_ids: ids,
    p_system_prompts: ids.map((id) => remapSteps(byId.get(id)!.system_prompt, map)),
    p_templates: ids.map((id) => remapSteps(byId.get(id)!.user_prompt_template, map)),
  })
  if (rpcErr) {
    if (/reorder_chain_steps/.test(rpcErr.message) && /find|exist/i.test(rpcErr.message))
      return { error: 'Run supabase/week8.sql in Supabase first. The reorder function is missing.' }
    return { error: rpcErr.message }
  }
  return {}
}

export async function reorderSteps(chainId: number, orderedIds: number[]): Promise<Result> {
  const { supabase } = await requireAdmin()
  const { data: steps } = await supabase
    .from('prompt_chain_steps')
    .select('id, step_order')
    .eq('chain_id', chainId)
  const map = new Map<number, number | null>()
  for (const s of steps ?? []) map.set(s.step_order, orderedIds.indexOf(s.id) + 1)

  const res = await applyOrder(supabase, chainId, orderedIds, map)
  revalidatePath(`/chains/${chainId}`, 'layout')
  return res
}

export async function deleteStep(stepId: number): Promise<Result> {
  const { supabase } = await requireAdmin()
  const { data: step } = await supabase
    .from('prompt_chain_steps')
    .select('id, chain_id, step_order')
    .eq('id', stepId)
    .single()
  if (!step) return { error: "That step doesn't exist anymore." }

  const { error } = await supabase.from('prompt_chain_steps').delete().eq('id', stepId)
  if (error) return { error: error.message }

  // Close the gap (1, 2, 4 → 1, 2, 3) and fix {{step_N}} references.
  const { data: rest } = await supabase
    .from('prompt_chain_steps')
    .select('id, step_order')
    .eq('chain_id', step.chain_id)
    .order('step_order')
  const map = new Map<number, number | null>([[step.step_order, null]])
  ;(rest ?? []).forEach((s, i) => map.set(s.step_order, i + 1))
  const res = await applyOrder(supabase, step.chain_id, (rest ?? []).map((s) => s.id), map)

  revalidatePath(`/chains/${step.chain_id}`, 'layout')
  revalidatePath('/')
  return res
}

// ---------------------------------------------------------------- media

export async function publishCaption(requestId: number, text: string): Promise<Result & { id?: number }> {
  const { supabase, user } = await requireAdmin()
  const caption = text.trim()
  if (!caption) return { error: 'The caption is empty.' }
  if (caption.length > 500) return { error: 'Captions can be at most 500 characters.' }

  const { data: run } = await supabase
    .from('generation_requests')
    .select('id, chain_id, image_url, prompt')
    .eq('id', requestId)
    .single()
  if (!run) return { error: "That run doesn't exist anymore." }
  if (!run.image_url) return { error: 'This run had no image, so it can\'t become a caption in the app.' }

  const { data, error } = await supabase
    .from('captions')
    .insert({
      text: caption,
      image_url: run.image_url,
      prompt: run.prompt,
      created_by: user.id,
      chain_id: run.chain_id,
      generation_request_id: run.id,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  if (run.chain_id) revalidatePath(`/chains/${run.chain_id}/media`)
  return { id: data.id }
}

export async function deleteRun(requestId: number): Promise<Result> {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from('generation_requests')
    .delete()
    .eq('id', requestId)
    .select('chain_id')
    .single()
  if (error) return { error: error.message }
  if (data.chain_id) revalidatePath(`/chains/${data.chain_id}/media`)
  return {}
}
