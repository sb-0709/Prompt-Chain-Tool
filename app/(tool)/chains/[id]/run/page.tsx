import { requireAdmin } from '@/lib/auth'
import RunPanel from '@/components/RunPanel'

export const dynamic = 'force-dynamic'

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const chainId = Number(id)
  const { supabase } = await requireAdmin()

  const [{ data: steps }, { data: captionImgs }, { data: runImgs }] = await Promise.all([
    supabase
      .from('prompt_chain_steps')
      .select('step_order, name, include_image, system_prompt, user_prompt_template')
      .eq('chain_id', chainId)
      .order('step_order'),
    supabase.from('captions').select('image_url').not('image_url', 'is', null).order('created_at', { ascending: false }).limit(40),
    supabase.from('generation_requests').select('image_url').not('image_url', 'is', null).order('created_at', { ascending: false }).limit(40),
  ])

  const recent = [...new Set([...(runImgs ?? []), ...(captionImgs ?? [])].map((r) => r.image_url as string))].slice(0, 18)
  const list = steps ?? []
  const usesUserPrompt = list.some((s) =>
    /\{\{\s*user_prompt\s*\}\}/.test(`${s.system_prompt ?? ''} ${s.user_prompt_template}`)
  )

  if (list.length === 0)
    return (
      <div className="panel empty">
        <strong>Nothing to run yet</strong>
        Add at least one step on the Steps tab.
      </div>
    )

  return (
    <RunPanel
      chainId={chainId}
      steps={list.map((s) => ({ order: s.step_order, name: s.name }))}
      needsImage={list.some((s) => s.include_image)}
      usesUserPrompt={usesUserPrompt}
      recentImages={recent}
    />
  )
}
