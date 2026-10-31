import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import ThemeToggle from '@/components/ThemeToggle'
import { getTheme } from '@/lib/theme'

export default async function ToolLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin()
  const theme = await getTheme()

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <svg viewBox="0 0 16 40" aria-hidden="true">
            <line x1="8" y1="6" x2="8" y2="34" />
            <circle cx="8" cy="6" r="4" />
            <circle cx="8" cy="20" r="4" />
            <circle cx="8" cy="34" r="4" className="filled" />
          </svg>
          Prompt chains
        </Link>
        <div className="topbar-right">
          <ThemeToggle initial={theme} />
          <span className="who" title={user.email ?? ''}>{user.email}</span>
          <form action="/auth/signout" method="post">
            <button className="btn btn-quiet btn-sm">Sign out</button>
          </form>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  )
}
