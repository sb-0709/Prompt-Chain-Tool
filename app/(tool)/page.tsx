import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import NewChainForm from '@/components/NewChainForm'

export const dynamic = 'force-dynamic'

export default async function ChainsPage() {
  const { supabase } = await requireAdmin()
  const { data: chains, error } = await supabase
    .from('prompt_chains')
    .select('id, name, description, is_active, created_at, prompt_chain_steps(count), generation_requests(count)')
    .order('created_at', { ascending: false })

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Prompt chains</h1>
          <p className="page-sub">
            Each chain runs its steps in order. A step can use the image, the text you type when
            you run it, and the output of any earlier step.
          </p>
        </div>
        <NewChainForm />
      </div>

      {error && <p className="notice notice-error">Couldn&apos;t load chains: {error.message}</p>}

      {chains && chains.length === 0 && (
        <div className="panel empty">
          <strong>No chains yet</strong>
          Create one with New chain, then add its first step.
        </div>
      )}

      {chains && chains.length > 0 && (
        <ul className="chain-list">
          {chains.map((c) => {
            const steps = (c.prompt_chain_steps as unknown as { count: number }[])[0]?.count ?? 0
            const runs = (c.generation_requests as unknown as { count: number }[])[0]?.count ?? 0
            return (
              <li key={c.id}>
                <Link href={`/chains/${c.id}`} className="chain-row">
                  <span className="mini-rail" aria-hidden="true">
                    {Array.from({ length: Math.min(Math.max(steps, 1), 5) }, (_, i) => (
                      <span key={i} />
                    ))}
                  </span>
                  <div>
                    <h2>
                      {c.name}{' '}
                      {!c.is_active && <span className="badge">Inactive</span>}
                    </h2>
                    {c.description && <p>{c.description}</p>}
                  </div>
                  <div className="chain-meta">
                    <span>{steps} {steps === 1 ? 'step' : 'steps'}</span>
                    <span>{runs} {runs === 1 ? 'run' : 'runs'}</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
