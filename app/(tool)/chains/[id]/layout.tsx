import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import ChainHeader from '@/components/ChainHeader'
import ChainTabs from '@/components/ChainTabs'

export default async function ChainLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const chainId = Number(id)
  if (!Number.isInteger(chainId)) notFound()

  const { supabase } = await requireAdmin()
  const { data: chain } = await supabase
    .from('prompt_chains')
    .select('id, name, description, is_active, created_at')
    .eq('id', chainId)
    .maybeSingle()
  if (!chain) notFound()

  return (
    <>
      <Link href="/" className="back">← All chains</Link>
      <ChainHeader chain={chain} />
      <ChainTabs chainId={chain.id} />
      {children}
    </>
  )
}
