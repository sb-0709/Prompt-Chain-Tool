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
              A chain is a list of prompts that run in order, each one building on the last. For any
              chain you can edit its steps, generate media by running it on an image, and view
              everything it has generated.
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
                const base = `/chains/${c.id}`
                return (
                    <li key={c.id} className="chain-row">
                <span className="mini-rail" aria-hidden="true">
                  {Array.from({ length: Math.min(Math.max(steps, 1), 5) }, (_, i) => (
                      <span key={i} />
                  ))}
                </span>
                      <div className="chain-text">
                        <h2>
                          <Link href={base} className="chain-link">{c.name}</Link>{' '}
                          {!c.is_active && <span className="badge">Inactive</span>}
                        </h2>
                        {c.description && <p>{c.description}</p>}
                      </div>
                      <div className="chain-actions">
                        <Link href={base} className="btn btn-sm">
                          Edit steps ({steps})
                        </Link>
                        {steps > 0 ? (
                            <Link href={`${base}/run`} className="btn btn-sm">
                              Generate media
                            </Link>
                        ) : (
                            <span className="btn btn-sm" aria-disabled="true" title="Add a step first">
                      Generate media
                    </span>
                        )}
                        <Link href={`${base}/media`} className="btn btn-sm">
                          View media ({runs})
                        </Link>
                      </div>
                    </li>
                )
              })}
            </ul>
        )}
      </>
  )
}