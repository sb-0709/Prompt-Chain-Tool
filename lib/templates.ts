// Template variables available in a step's prompts:
//   {{user_prompt}}      text typed when the chain is run (optional)
//   {{previous_output}}  output of the step right before this one
//   {{step_N}}           output of step N (must run before this step)

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

export const BASE_VARS = ['user_prompt', 'previous_output'] as const

export type TemplatePart = { text: string; variable?: string }

/** Split text into plain parts and {{variable}} parts, for highlighting. */
export function splitTemplate(text: string): TemplatePart[] {
  const parts: TemplatePart[] = []
  let last = 0
  for (const m of text.matchAll(VAR_RE)) {
    if (m.index! > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ text: m[0], variable: m[1] })
    last = m.index! + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

/** Problems with the variables a step uses, given its position in the chain. */
export function checkStep(texts: (string | null | undefined)[], order: number, stepCount: number): string[] {
  const problems = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    for (const m of text.matchAll(VAR_RE)) {
      const v = m[1]
      const n = /^step_(\d+)$/.exec(v)
      if (n) {
        const k = Number(n[1])
        if (k >= order && k <= stepCount) problems.add(`{{${v}}} runs after this step, so it will be empty.`)
        else if (k < 1 || k > stepCount) problems.add(`{{${v}}} doesn't exist. This chain has ${stepCount} step${stepCount === 1 ? '' : 's'}.`)
      } else if (v === 'previous_output') {
        if (order === 1) problems.add('{{previous_output}} is empty in step 1. Use it from step 2 on.')
      } else if (v !== 'user_prompt') {
        problems.add(`{{${v}}} isn't a known variable.`)
      }
    }
  }
  return [...problems]
}

/**
 * Renumber {{step_N}} references after steps move or are deleted.
 * `map` goes from old step number to new number (null = step was deleted).
 */
export function remapSteps(text: string | null, map: Map<number, number | null>): string | null {
  if (text == null) return text
  return text.replace(/\{\{\s*step_(\d+)\s*\}\}/g, (whole, n) => {
    const old = Number(n)
    if (!map.has(old)) return whole
    const next = map.get(old)
    return next == null ? '{{deleted_step}}' : `{{step_${next}}}`
  })
}

/** Fill in variables for a run. Unknown variables become empty. */
export function render(
  text: string,
  ctx: { userPrompt: string; outputs: string[] }
): string {
  return text
    .replace(VAR_RE, (_, v: string) => {
      if (v === 'user_prompt') return ctx.userPrompt
      if (v === 'previous_output') return ctx.outputs[ctx.outputs.length - 1] ?? ''
      const n = /^step_(\d+)$/.exec(v)
      if (n) return ctx.outputs[Number(n[1]) - 1] ?? ''
      return ''
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Turn a model's list-like answer into separate lines (for "publish one caption"). */
export function splitLines(output: string): string[] {
  return output
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["“]|["”]$/g, '').trim())
    .filter((l) => l.length > 0 && l.length <= 500)
}
