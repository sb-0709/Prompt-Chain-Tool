'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginButton() {
  const [loading, setLoading] = useState(false)

  const signIn = async () => {
    setLoading(true)
    await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <button className="btn btn-primary btn-wide" onClick={signIn} disabled={loading}>
      {loading ? 'Opening Google…' : 'Sign in with Google'}
    </button>
  )
}
