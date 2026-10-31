import LoginButton from '@/components/LoginButton'
import ThemeToggle from '@/components/ThemeToggle'
import { getTheme } from '@/lib/theme'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const theme = await getTheme()

  return (
    <main className="gate">
      <div className="gate-theme">
        <ThemeToggle initial={theme} />
      </div>
      <div className="gate-card">
        <ChainMark />
        <h1 className="gate-title">Prompt chains</h1>
        <p className="gate-copy">
          Build multi-step prompts, put the steps in order, and run them on an image to see what
          each step produces. Sign in with a Google account that has superadmin access.
        </p>
        {error && <p className="notice notice-error">Sign-in didn&apos;t finish. Try again.</p>}
        <LoginButton />
      </div>
    </main>
  )
}

function ChainMark() {
  return (
    <svg className="gate-mark" viewBox="0 0 40 120" aria-hidden="true">
      <line x1="20" y1="14" x2="20" y2="106" />
      <circle cx="20" cy="14" r="9" />
      <circle cx="20" cy="60" r="9" />
      <circle cx="20" cy="106" r="9" className="filled" />
    </svg>
  )
}
