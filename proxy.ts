import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Runs before EVERY route. Only /login, /auth/* and /not-authorized are open;
// everything else needs a signed-in user whose profile has is_superadmin = true.
const PUBLIC = ['/login', '/auth/callback', '/not-authorized']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const path = request.nextUrl.pathname
  const redirectTo = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url))
    response.cookies.getAll().forEach((c) => r.cookies.set(c))
    return r
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (PUBLIC.includes(path) || path === '/auth/signout') {
    if (path === '/login' && user) {
      // fall through to the admin check so signed-in admins skip the login page
    } else {
      return response
    }
  }

  if (!user) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
    return redirectTo('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.is_superadmin === true

  if (path === '/login') return isAdmin ? redirectTo('/') : redirectTo('/not-authorized')
  if (!isAdmin) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Superadmins only.' }, { status: 403 })
    return redirectTo('/not-authorized')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
}
