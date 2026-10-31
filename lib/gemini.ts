import 'server-only'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type GeminiImage = { mime: string; base64: string }

export type GeminiResult = {
  text: string
  inputTokens: number | null
  outputTokens: number | null
  finishReason: string | null
}

/** Download an image once so every step that needs it can reuse it. */
export async function loadImage(url: string): Promise<GeminiImage> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Couldn't download the image (${res.status}).`)
  const mime = res.headers.get('content-type')?.split(';')[0] ?? ''
  if (!mime.startsWith('image/')) throw new Error("That URL doesn't point to an image.")
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Image is larger than 8 MB.')
  return { mime, base64: bytes.toString('base64') }
}

/** One Gemini call. Retries when the model is busy (429 / 503). */
export async function callGemini(opts: {
  model: string
  system?: string | null
  prompt: string
  temperature?: number | null
  image?: GeminiImage | null
}): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set for this app.')

  const parts: object[] = [{ text: opts.prompt }]
  if (opts.image) parts.push({ inline_data: { mime_type: opts.image.mime, data: opts.image.base64 } })

  const body = JSON.stringify({
    ...(opts.system?.trim() ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    contents: [{ role: 'user', parts }],
    ...(opts.temperature != null ? { generationConfig: { temperature: Number(opts.temperature) } } : {}),
  })

  let lastError = 'Gemini did not respond.'
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body }
    )
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      const cand = data.candidates?.[0]
      const text = (cand?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? '')
        .join('')
        .trim()
      if (!text) {
        const why = cand?.finishReason ?? data.promptFeedback?.blockReason
        throw new Error(`Gemini returned no text${why ? ` (${why})` : ''}.`)
      }
      return {
        text,
        inputTokens: data.usageMetadata?.promptTokenCount ?? null,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
        finishReason: cand?.finishReason ?? null,
      }
    }
    lastError = data.error?.message ?? `Gemini error ${res.status}`
    if (res.status === 429 || res.status === 503) {
      await sleep(1000 * 2 ** attempt)
      continue
    }
    if (res.status === 404) lastError = `Model "${opts.model}" wasn't found. Check its API model ID in the admin panel.`
    break
  }
  throw new Error(lastError)
}
