import { config, hasLlm, llmProvider } from '../config.js'

type TextBlock = { type: 'text'; text: string }
type ImageBlock = { type: 'image_url'; image_url: { url: string } }
type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<TextBlock | ImageBlock>
}

type LlmResult = {
  configured: boolean
  text: string
  error?: string
}

const forbiddenClaims = /\b(guarantee(?:d|s)?|certain(?:ly)?|will definitely|100\s*%|no risk|sure (?:win|profit)|always profit|never lose|can't lose)\b/i

export function safeText(text: string, fallback: string): string {
  const cleaned = text.replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!cleaned || forbiddenClaims.test(cleaned)) return fallback
  return cleaned
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  return { mediaType: match[1], data: match[2] }
}

async function callOpenAI(
  system: string, prompt: string, model: string, imageDataUrl?: string, maxTokens = 500,
): Promise<string> {
  const userContent: string | Array<TextBlock | ImageBlock> = imageDataUrl
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ]
    : prompt
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ]

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.llmKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`)
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return body.choices?.[0]?.message?.content ?? ''
}

async function callAnthropic(
  system: string, prompt: string, model: string, imageDataUrl?: string, maxTokens = 500,
): Promise<string> {
  const parsed = imageDataUrl ? parseDataUrl(imageDataUrl) : null
  const content: unknown[] = [{ type: 'text', text: prompt }]
  if (parsed) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data },
    })
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.llmKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, system, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`)
  const body = (await response.json()) as { content?: Array<{ type?: string; text?: string }> }
  return (body.content ?? []).filter((block) => block.type === 'text').map((block) => block.text ?? '').join('\n')
}

type GeminiPart =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mime_type: string }

type GeminiStep = {
  type?: string
  content?: Array<{ type?: string; text?: string }>
}

type GeminiResponse = {
  output_text?: string
  interaction?: { output_text?: string; steps?: GeminiStep[] }
  steps?: GeminiStep[]
}

function geminiOutputText(body: GeminiResponse): string {
  if (typeof body.output_text === 'string' && body.output_text.trim()) return body.output_text
  if (typeof body.interaction?.output_text === 'string' && body.interaction.output_text.trim()) {
    return body.interaction.output_text
  }
  const steps = body.steps ?? body.interaction?.steps ?? []
  const parts: string[] = []
  for (const step of steps) {
    if (step.type && step.type !== 'model_output') continue
    for (const item of step.content ?? []) {
      if (item.type === 'text' && typeof item.text === 'string') parts.push(item.text)
    }
  }
  return parts.join('\n')
}

async function callGemini(
  system: string, prompt: string, model: string, imageDataUrl?: string, maxTokens = 500,
): Promise<string> {
  const parsed = imageDataUrl ? parseDataUrl(imageDataUrl) : null
  const input: GeminiPart[] = [{ type: 'text', text: prompt }]
  if (parsed) {
    input.push({ type: 'image', data: parsed.data, mime_type: parsed.mediaType })
  }

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.llmKey,
      'Api-Revision': '2026-05-20',
    },
    body: JSON.stringify({
      model,
      input,
      system_instruction: system,
      // Higher floor leaves room for reasoning tokens on Gemini 4 models.
      generation_config: { max_output_tokens: Math.max(maxTokens, 4096) },
      // Do not ask Google to retain uploaded chart screenshots.
      store: false,
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, ' ').trim().slice(0, 300)
    throw new Error(`AI provider returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
  }
  return geminiOutputText(await response.json() as GeminiResponse)
}

export async function askLlm(options: {
  system: string
  prompt: string
  model?: string
  imageDataUrl?: string
  maxTokens?: number
}): Promise<LlmResult> {
  const provider = llmProvider()
  if (!hasLlm() || provider === 'none') {
    return { configured: false, text: '' }
  }
  const model = options.model || config.llmModel
  try {
    const text = provider === 'openai'
      ? await callOpenAI(options.system, options.prompt, model, options.imageDataUrl, options.maxTokens)
      : provider === 'gemini'
        ? await callGemini(options.system, options.prompt, model, options.imageDataUrl, options.maxTokens)
        : await callAnthropic(options.system, options.prompt, model, options.imageDataUrl, options.maxTokens)
    return { configured: true, text }
  } catch (error) {
    return {
      configured: true,
      text: '',
      error: error instanceof Error ? error.message : 'AI provider request failed',
    }
  }
}

export const notConfiguredMessage =
  'The AI language service is not configured yet. Add LLM_PROVIDER (openai, anthropic or gemini) and LLM_API_KEY to server/.env to enable explanations, chat and screenshot analysis. Deterministic technical analysis from available candle data still works without it.'
