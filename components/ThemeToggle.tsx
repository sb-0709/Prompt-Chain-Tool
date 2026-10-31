'use client'

import { useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="3.5" />
        <path d="M10 1.5v2.2M10 16.3v2.2M1.5 10h2.2M16.3 10h2.2M4 4l1.6 1.6M14.4 14.4 16 16M4 16l1.6-1.6M14.4 5.6 16 4" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'System',
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
        <path d="M7 17h6M10 13.5V17" />
      </svg>
    ),
  },
]

export default function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial)

  const choose = (t: Theme) => {
    setTheme(t)
    document.documentElement.dataset.theme = t
    document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Color theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          title={`${o.label} theme`}
          onClick={() => choose(o.value)}
        >
          {o.icon}
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
