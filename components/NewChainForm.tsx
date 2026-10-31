'use client'

import { useActionState, useState } from 'react'
import { createChain } from '@/app/(tool)/actions'

export default function NewChainForm() {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createChain, undefined)

  if (!open)
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        New chain
      </button>
    )

  return (
    <form action={action} className="panel form-grid" style={{ width: '100%' }}>
      <label className="field">
        Name
        <input type="text" name="name" required autoFocus placeholder="e.g. Image → five captions" />
      </label>
      <label className="field">
        <span>
          Description <span className="field-hint">(optional)</span>
        </span>
        <textarea name="description" rows={2} placeholder="What this chain is for" />
      </label>
      {state?.error && <p className="notice notice-error">{state.error}</p>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create chain'}
        </button>
      </div>
    </form>
  )
}
