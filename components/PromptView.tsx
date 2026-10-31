import { splitTemplate } from '@/lib/templates'

/** Shows a prompt with its {{variables}} highlighted. Bad ones turn red. */
export default function PromptView({ text, bad = [] }: { text: string; bad?: string[] }) {
  return (
    <pre className="prompt-view">
      {splitTemplate(text).map((p, i) =>
        p.variable ? (
          <span key={i} className={bad.includes(p.variable) ? 'var var-bad' : 'var'}>
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </pre>
  )
}
