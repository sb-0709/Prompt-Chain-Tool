'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PublishLines from './PublishLines'

type StepInfo = { order: number; name: string }
type StepState = {
  status: 'pending' | 'running' | 'done' | 'error'
  text?: string
  ms?: number
  tokens?: number | null
  model?: string
}
type Source = 'upload' | 'recent' | 'link' | 'none'

export default function RunPanel({
  chainId,
  steps,
  needsImage,
  usesUserPrompt,
  recentImages,
}: {
  chainId: number
  steps: StepInfo[]
  needsImage: boolean
  usesUserPrompt: boolean
  recentImages: string[]
}) {
  const [source, setSource] = useState<Source>(needsImage ? 'upload' : 'none')
  const [imageUrl, setImageUrl] = useState('')
  const [linkDraft, setLinkDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const [over, setOver] = useState(false)
  const [userPrompt, setUserPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [runSteps, setRunSteps] = useState<StepInfo[]>(steps)
  const [state, setState] = useState<Record<number, StepState>>({})
  const [result, setResult] = useState<{ requestId: number; output: string; ms: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return setError('Choose an image file (JPG, PNG, WebP or GIF).')
    if (file.size > 8 * 1024 * 1024) return setError('That image is over 8 MB. Pick a smaller one.')
    setError('')
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('chain-inputs')
      .upload(path, file, { contentType: file.type })
    setUploading(false)
    if (upErr)
      return setError(
        /bucket not found/i.test(upErr.message)
          ? 'The chain-inputs storage bucket is missing. Run supabase/week8.sql first.'
          : `Upload failed: ${upErr.message}`
      )
    setImageUrl(supabase.storage.from('chain-inputs').getPublicUrl(path).data.publicUrl)
  }

  const chooseSource = (s: Source) => {
    setSource(s)
    setImageUrl(s === 'link' ? linkDraft : '')
    setError('')
  }

  const run = async () => {
    setError('')
    setResult(null)
    setRunning(true)
    setState(Object.fromEntries(steps.map((s) => [s.order, { status: 'pending' }])))

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId, imageUrl: imageUrl || null, userPrompt }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `The run couldn't start (${res.status}).`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const ev = JSON.parse(line)
          if (ev.type === 'start') {
            setRunSteps(ev.steps)
            setState(
              Object.fromEntries(
                ev.steps.map((s: StepInfo & { model: string }) => [s.order, { status: 'pending', model: s.model }])
              )
            )
          } else if (ev.type === 'step-start') {
            setState((st) => ({ ...st, [ev.order]: { ...st[ev.order], status: 'running' } }))
          } else if (ev.type === 'step') {
            setState((st) => ({
              ...st,
              [ev.order]: {
                ...st[ev.order],
                status: 'done',
                text: ev.text,
                ms: ev.ms,
                tokens: ev.outputTokens,
              },
            }))
          } else if (ev.type === 'done') {
            setResult({ requestId: ev.requestId, output: ev.output, ms: ev.ms })
          } else if (ev.type === 'error') {
            if (ev.order)
              setState((st) => ({ ...st, [ev.order]: { ...st[ev.order], status: 'error', text: ev.message } }))
            setError(ev.order ? `Step ${ev.order} failed: ${ev.message}` : ev.message)
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The run failed.')
    } finally {
      setRunning(false)
    }
  }

  const started = Object.keys(state).length > 0
  const ready = !running && !uploading && (!needsImage || !!imageUrl)

  return (
    <>
      <section className="panel run-setup" aria-label="Run settings">
        <div className="form-grid" style={{ gap: 10 }}>
          <div className="prompt-label" style={{ fontSize: 13, color: 'var(--ink)' }}>
            Image{' '}
            <span className="field-hint">
              {needsImage ? '(needed: a step is set to see it)' : '(no step uses an image)'}
            </span>
          </div>
          <div className="source-tabs" role="group" aria-label="Image source">
            {(
              [
                ['upload', 'Upload'],
                ['recent', 'Recent images'],
                ['link', 'Paste a link'],
                ...(needsImage ? [] : [['none', 'No image']]),
              ] as [Source, string][]
            ).map(([s, label]) => (
              <button key={s} type="button" aria-pressed={source === s} onClick={() => chooseSource(s)}>
                {label}
              </button>
            ))}
          </div>

          {source === 'upload' &&
            (imageUrl ? (
              <div className="preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Image this chain will run on" />
                <button className="btn btn-sm" onClick={() => setImageUrl('')}>
                  Choose a different image
                </button>
              </div>
            ) : (
              <label
                className={over ? 'drop is-over' : 'drop'}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver(true)
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setOver(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) upload(f)
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) upload(f)
                  }}
                />
                <strong>{uploading ? 'Uploading…' : 'Drop an image here or click to choose one'}</strong>
                <span>JPG, PNG, WebP or GIF, up to 8 MB</span>
              </label>
            ))}

          {source === 'recent' &&
            (recentImages.length ? (
              <div className="thumbs">
                {recentImages.map((url) => (
                  <button
                    key={url}
                    type="button"
                    aria-pressed={imageUrl === url}
                    onClick={() => setImageUrl(url)}
                    title="Use this image"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>No images yet. Upload one instead.</p>
            ))}

          {source === 'link' && (
            <input
              type="url"
              placeholder="https://…/photo.jpg"
              value={linkDraft}
              onChange={(e) => {
                setLinkDraft(e.target.value)
                setImageUrl(e.target.value.trim())
              }}
            />
          )}
        </div>

        <label className="field">
          <span>
            Extra instructions{' '}
            <span className="field-hint">
              {usesUserPrompt
                ? 'fills {{user_prompt}} in this chain'
                : 'no step uses {{user_prompt}}, so this is only saved with the run'}
            </span>
          </span>
          <textarea
            rows={2}
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="e.g. Make the jokes about finals week."
          />
        </label>

        {error && <p className="notice notice-error">{error}</p>}

        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-primary" onClick={run} disabled={!ready}>
            {running ? 'Running…' : started ? 'Run again' : `Run ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`}
          </button>
        </div>
      </section>

      {started && (
        <ol className="rail" aria-label="Run progress" aria-live="polite">
          {runSteps.map((s) => {
            const st = state[s.order] ?? { status: 'pending' }
            return (
              <li key={s.order}>
                <span className={`node is-${st.status}`} aria-hidden="true">{s.order}</span>
                <article className="step">
                  <div className="step-head">
                    <div className="step-title">
                      <h3>{s.name}</h3>
                      <div className="step-facts">
                        {st.model && <span>{st.model}</span>}
                        <span>
                          {st.status === 'pending' && 'Waiting'}
                          {st.status === 'running' && 'Running'}
                          {st.status === 'error' && 'Failed'}
                          {st.status === 'done' && `${(st.ms! / 1000).toFixed(1)} s`}
                        </span>
                        {st.status === 'done' && st.tokens != null && <span>{st.tokens} output tokens</span>}
                      </div>
                    </div>
                  </div>
                  {(st.text || st.status === 'running') && (
                    <div className="step-body">
                      {st.status === 'running' ? (
                        <p className="output output-pending">Waiting for the model…</p>
                      ) : (
                        <p className="output" style={st.status === 'error' ? { borderLeftColor: 'var(--danger)' } : undefined}>
                          {st.text}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              </li>
            )
          })}
        </ol>
      )}

      {result && (
        <section className="panel form-grid" style={{ marginTop: 28 }} aria-label="Result">
          <div className="page-head" style={{ marginBottom: 0 }}>
            <div>
              <h2 style={{ fontSize: 18 }}>Final output</h2>
              <p className="page-sub">
                Finished in {(result.ms / 1000).toFixed(1)} s and saved to this chain&apos;s media.
                {imageUrl ? ' Publish any line to show it in the caption app.' : ''}
              </p>
            </div>
            <Link href={`/chains/${chainId}/media`} className="btn btn-sm">
              Open media
            </Link>
          </div>
          <PublishLines requestId={result.requestId} output={result.output} canPublish={!!imageUrl} />
        </section>
      )}
    </>
  )
}
