import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Second line of defence after proxy.ts: every page, server action and
 * API route calls this. Database policies (is_superadmin()) are the third.
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()

  if (profile?.is_superadmin !== true) redirect('/not-authorized')
  return { supabase, user }
}

/** Same check for API routes, which should answer 401/403 instead of redirecting. */
export async function checkAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in first.', status: 401 as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()
  if (profile?.is_superadmin !== true) return { error: 'Superadmins only.', status: 403 as const }
  return { supabase, user }
}
