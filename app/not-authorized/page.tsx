import { createClient } from '@/lib/supabase/server'

export default async function NotAuthorized() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="gate">
      <div className="gate-card">
        <h1 className="gate-title">This account can&apos;t open the chain tool</h1>
        <p className="gate-copy">
          {user?.email ? <>You&apos;re signed in as <strong>{user.email}</strong>. </> : null}
          Only profiles with <code>is_superadmin</code> turned on can use it. Ask a superadmin
          to promote you from the Users page of the admin panel, then sign in again.
        </p>
        <form action="/auth/signout" method="post">
          <button className="btn btn-wide">Sign out and switch account</button>
        </form>
      </div>
    </main>
  )
}
