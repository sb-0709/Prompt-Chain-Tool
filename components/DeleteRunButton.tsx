'use client'

import { useTransition } from 'react'
import { deleteRun } from '@/app/(tool)/actions'

export default function DeleteRunButton({ requestId }: { requestId: number }) {
  const [pending, start] = useTransition()
  return (
    <button
      className="btn btn-quiet btn-sm btn-danger"
      disabled={pending}
      onClick={() => {
        if (!confirm('Delete this run and its step outputs? Captions already published stay in the app.')) return
        start(async () => {
          const res = await deleteRun(requestId)
          if (res.error) alert(res.error)
        })
      }}
    >
      {pending ? 'Deleting…' : 'Delete run'}
    </button>
  )
}
