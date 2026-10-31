import { requireAdmin } from '@/lib/auth'
import StepList from '@/components/StepList'
import type { Model, Step } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function StepsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const chainId = Number(id)
  const { supabase } = await requireAdmin()

  const [{ data: steps, error }, { data: models }] = await Promise.all([
    supabase.from('prompt_chain_steps').select('*').eq('chain_id', chainId).order('step_order'),
    supabase.from('llm_models').select('id, name, model_id, supports_vision, is_active').order('name'),
  ])

  if (error) return <p className="notice notice-error">Couldn&apos;t load steps: {error.message}</p>

  const missingImageColumn = steps && steps.length > 0 && !('include_image' in steps[0])

  return (
    <>
      {missingImageColumn && (
        <p className="notice notice-warn" style={{ marginBottom: 16 }}>
          Run <code>supabase/week8.sql</code> in the Supabase SQL editor to turn on reordering and
          the image setting for each step.
        </p>
      )}
      <StepList
        chainId={chainId}
        initialSteps={(steps ?? []) as Step[]}
        models={(models ?? []) as Model[]}
      />
    </>
  )
}
