'use client'

import { useState, useTransition } from 'react'
import { deleteChain, duplicateChain, updateChain } from '@/app/(tool)/actions'
import type { Chain } from '@/lib/types'

export default function ChainHeader({ chain }: { chain: Chain }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(chain.name)
  const [description, setDescription] = useState(chain.description ?? '')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) => {
    setError('')
    start(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else after?.()
    })
  }

  if (editing)
    return (
      <form
        className="panel form-grid"
        style={{ marginBottom: 20 }}
        onSubmit={(e) => {
          e.preventDefault()
          run(() => updateChain(chain.id, { name, description }), () => setEditing(false))
        }}
      >
        <label className="field">
          Name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>
            Description <span className="field-hint">(optional)</span>
          </span>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error && <p className="notice notice-error">{error}</p>}
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setEditing(false)
              setName(chain.name)
              setDescription(chain.description ?? '')
              setError('')
            }}
          >
            Cancel
          </button>
          <button className="btn btn-primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save chain'}
          </button>
        </div>
      </form>
    )

  return (
    <div className="chain-head">
      <div>
        <h1 className="page-title">
          {chain.name}
          {!chain.is_active && <span className="badge">Inactive</span>}
        </h1>
        {chain.description && <p className="page-sub">{chain.description}</p>}
        {error && <p className="notice notice-error" style={{ marginTop: 10 }}>{error}</p>}
      </div>
      <div className="chain-head-actions">
        <button className="btn btn-sm" onClick={() => setEditing(true)} disabled={pending}>
          Edit
        </button>
        <button
          className="btn btn-sm"
          disabled={pending}
          title={chain.is_active ? 'Inactive chains are not picked by the caption app' : undefined}
          onClick={() => run(() => updateChain(chain.id, { is_active: !chain.is_active }))}
        >
          {chain.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button className="btn btn-sm" disabled={pending} onClick={() => run(() => duplicateChain(chain.id))}>
          Duplicate
        </button>
        <button
          className="btn btn-sm btn-danger"
          disabled={pending}
          onClick={() => {
            if (
              confirm(
                `Delete "${chain.name}" and all its steps? Past runs and published captions are kept, but no longer linked to a chain.`
              )
            )
              run(() => deleteChain(chain.id))
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
