import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import PublishLines from '@/components/PublishLines'
import DeleteRunButton from '@/components/DeleteRunButton'

export const dynamic = 'force-dynamic'

type Run = {
  id: number
  image_url: string | null
  prompt: string | null
  status: 'pending' | 'success' | 'error'
  error_message: string | null
  latency_ms: number | null
  source: string
  created_at: string
  llm_responses: { step_order: number; response_text: string | null; output_tokens: number | null }[]
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })

export default async function MediaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const chainId = Number(id)
  const { supabase } = await requireAdmin()

  const [{ data: runs, error }, { data: captions }, { count: total }] = await Promise.all([
    supabase
      .from('generation_requests')
      .select('id, image_url, prompt, status, error_message, latency_ms, source, created_at, llm_responses(step_order, response_text, output_tokens)')
      .eq('chain_id', chainId)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase.from('captions').select('text, generation_request_id').eq('chain_id', chainId),
    supabase.from('generation_requests').select('id', { count: 'exact', head: true }).eq('chain_id', chainId),
  ])

  if (error) return <p className="notice notice-error">Couldn&apos;t load media: {error.message}</p>

  const list = (runs ?? []) as Run[]
  const published = new Map<number, string[]>()
  for (const c of captions ?? []) {
    if (!c.generation_request_id) continue
    published.set(c.generation_request_id, [...(published.get(c.generation_request_id) ?? []), c.text])
  }

  const ok = list.filter((r) => r.status === 'success')
  const avg = ok.length ? ok.reduce((n, r) => n + (r.latency_ms ?? 0), 0) / ok.length / 1000 : null

  if (list.length === 0)
    return (
      <div className="panel empty">
        <strong>No media from this chain yet</strong>
        Everything this chain generates shows up here.{' '}
        <Link href={`/chains/${chainId}/run`}>Run it</Link> to make the first one.
      </div>
    )

  return (
    <>
      <div className="stats">
        <div><strong>{total ?? list.length}</strong>runs</div>
        <div><strong>{list.length ? Math.round((ok.length / list.length) * 100) : 0}%</strong>succeeded{list.length < (total ?? 0) ? ' (latest 60)' : ''}</div>
        <div><strong>{avg != null ? `${avg.toFixed(1)} s` : '–'}</strong>average run time</div>
        <div><strong>{captions?.length ?? 0}</strong>captions published</div>
      </div>

      <div className="runs">
        {list.map((r) => {
          const responses = [...r.llm_responses].sort((a, b) => a.step_order - b.step_order)
          const final = r.status === 'success' ? responses[responses.length - 1]?.response_text ?? '' : ''
          return (
            <article key={r.id} className="run-card">
              {r.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image_url} alt="Input image for this run" loading="lazy" />
              ) : (
                <div className="no-img">Text only</div>
              )}
              <div className="run-main">
                <div className="run-top">
                  <span className={r.status === 'success' ? 'badge badge-ok' : r.status === 'error' ? 'badge badge-error' : 'badge'}>
                    {r.status === 'success' ? 'Done' : r.status === 'error' ? 'Failed' : 'Unfinished'}
                  </span>
                  <span>{when(r.created_at)}</span>
                  {r.latency_ms != null && <span>{(r.latency_ms / 1000).toFixed(1)} s</span>}
                  {r.source === 'app' && <span>From the caption app</span>}
                  <span style={{ marginLeft: 'auto' }}>
                    <DeleteRunButton requestId={r.id} />
                  </span>
                </div>
                {r.prompt && (
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                    Extra instructions: {r.prompt}
                  </p>
                )}
                {r.status === 'error' && <p className="notice notice-error">{r.error_message ?? 'This run failed.'}</p>}
                {final && (
                  <PublishLines
                    requestId={r.id}
                    output={final}
                    alreadyPublished={published.get(r.id) ?? []}
                    canPublish={!!r.image_url}
                  />
                )}
                {responses.length > 0 && (
                  <details>
                    <summary>Show all {responses.length} step outputs</summary>
                    <ol className="trace">
                      {responses.map((s) => (
                        <li key={s.step_order}>
                          <div className="trace-head">
                            Step {s.step_order}
                            {s.output_tokens != null ? `, ${s.output_tokens} tokens` : ''}
                          </div>
                          <pre>{s.response_text}</pre>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
