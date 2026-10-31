import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="gate">
      <div className="gate-card">
        <h1 className="gate-title">That page doesn&apos;t exist</h1>
        <p className="gate-copy">The chain may have been deleted.</p>
        <Link href="/" className="btn btn-wide">Back to all chains</Link>
      </div>
    </main>
  )
}
