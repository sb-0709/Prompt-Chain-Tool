'use client'

import { useState, useTransition } from 'react'
import { publishCaption } from '@/app/(tool)/actions'
import { splitLines } from '@/lib/templates'

/** Splits a run's final output into lines; each one can go live in the caption app. */
export default function PublishLines({
  requestId,
  output,
  alreadyPublished = [],
  canPublish = true,
}: {
  requestId: number
  output: string
  alreadyPublished?: string[]
  canPublish?: boolean
}) {
  const lines = splitLines(output)
  const [done, setDone] = useState<Set<string>>(new Set(alreadyPublished.map((t) => t.trim())))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [, start] = useTransition()

  if (lines.length === 0) return null

  return (
    <div className="form-grid" style={{ gap: 8 }}>
      <ul className="lines">
        {lines.map((line) => (
          <li key={line}>
            <span>{line}</span>
            {done.has(line) ? (
              <span className="published">Published</span>
            ) : canPublish ? (
              <button
                className="btn btn-sm"
                disabled={busy !== null}
                onClick={() => {
                  setBusy(line)
                  setError('')
                  start(async () => {
                    const res = await publishCaption(requestId, line)
                    setBusy(null)
                    if (res.error) setError(res.error)
                    else setDone((d) => new Set(d).add(line))
                  })
                }}
              >
                {busy === line ? 'Publishing…' : 'Publish caption'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {error && <p className="notice notice-error">{error}</p>}
    </div>
  )
}
