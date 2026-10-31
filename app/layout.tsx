import type { Metadata } from 'next'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/jetbrains-mono'
import './globals.css'
import { getTheme } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'Prompt chains',
  description: 'Build, order and run multi-step prompt chains.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme()
  return (
    <html lang="en" data-theme={theme}>
      <body>{children}</body>
    </html>
  )
}
