'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function ChainTabs({ chainId }: { chainId: number }) {
  const path = usePathname()
  const base = `/chains/${chainId}`
  const tabs = [
    { href: base, label: 'Steps' },
    { href: `${base}/run`, label: 'Run' },
    { href: `${base}/media`, label: 'Media' },
  ]
  return (
    <nav className="tabs" aria-label="Chain sections">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
