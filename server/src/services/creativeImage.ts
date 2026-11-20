import { createHash } from 'node:crypto'
import {
  config, creativeImageProviders, hasCreativeImage, hasRemoveBg, supportedCreativeImageProviders,
  type ConfiguredImageProvider,
} from '../config.js'
import { askLlm } from './llm.js'
import type {
  CreativeBriefPlan, CreativeCapability, CreativeCatalogResponse, CreativeConfigResponse,
  CreativeImagePricing, CreativeImagePreflight, CreativeProviderStatus, CreativeQuotaState,
} from '../types.js'

export const CREATIVE_CATEGORIES = [
  'Plumbing Services', 'Construction', 'Architecture', 'Restaurant', 'Food & Fast Food', 'Cafe',
  'Gaming', 'Esports', 'Football', 'Sports', 'Business', 'Corporate', 'Real Estate', 'Fashion',
  'Clothing', 'Technology', 'Electronics', 'Education', 'Travel', 'Tourism', 'Beauty & Salon',
  'Events', 'Festivals', 'Product Advertisement', 'Social Media Promotion', 'YouTube Thumbnail',
  'Facebook Advertisement', 'Instagram Advertisement', 'Custom Category',
] as const

export const CREATIVE_TOOLS = [
  { id: 'poster', label: 'AI Poster Generator', defaultSize: 'instagram-portrait' },
  { id: 'advertisement', label: 'AI Advertisement Maker', defaultSize: 'facebook-post' },
  { id: 'banner', label: 'AI Banner Maker', defaultSize: 'promotional-banner' },
  { id: 'flyer', label: 'AI Flyer Maker', defaultSize: 'instagram-portrait' },
  { id: 'brochure', label: 'AI Brochure Maker', defaultSize: 'instagram-portrait' },
  { id: 'business-card', label: 'AI Business Card Maker', defaultSize: 'custom' },
  { id: 'thumbnail', label: 'AI Thumbnail Maker', defaultSize: 'youtube-thumbnail' },
  { id: 'menu', label: 'AI Restaurant Menu Designer', defaultSize: 'instagram-portrait' },
  { id: 'gaming', label: 'AI Gaming Poster Maker', defaultSize: 'instagram-portrait' },
  { id: 'esports', label: 'AI Esports Poster Maker', defaultSize: 'instagram-portrait' },
  { id: 'football', label: 'AI Football Match Poster Maker', defaultSize: 'instagram-portrait' },
  { id: 'product', label: 'AI Product Advertisement', defaultSize: 'instagram-square' },
  { id: 'social', label: 'AI Social Media Designer', defaultSize: 'instagram-square' },
  { id: 'background', label: 'AI Background Generator', defaultSize: 'instagram-portrait' },
  { id: 'logo-remover', label: 'AI Logo Background Remover', defaultSize: 'instagram-square' },
  { id: 'image-enhancer', label: 'AI Image Enhancer', defaultSize: 'instagram-square' },
  { id: 'slogan', label: 'AI Slogan Generator', defaultSize: 'instagram-square' },
  { id: 'description', label: 'AI Business Description Writer', defaultSize: 'instagram-square' },
  { id: 'promo', label: 'AI Promotional Text Writer', defaultSize: 'instagram-square' },
  { id: 'colors', label: 'AI Color Combination Generator', defaultSize: 'instagram-square' },
] as const

export const CREATIVE_STYLES = [
  'Ultra Luxury', 'Cinematic', 'Futuristic', 'Minimalist', 'Professional Corporate', '3D Premium',
  'Dark Luxury', 'Neon', 'Modern Editorial', 'Photorealistic', 'Magazine Style', 'Creative Artistic',
  'Glassmorphism', 'Bold Advertisement',
] as const

export const CREATIVE_SIZES = [
  { id: 'instagram-portrait', label: 'Instagram Portrait', width: 1080, height: 1350, ratio: '4:5' },
  { id: 'instagram-square', label: 'Instagram Square', width: 1080, height: 1080, ratio: '1:1' },
  { id: 'instagram-story', label: 'Instagram Story', width: 1080, height: 1920, ratio: '9:16' },
  { id: 'facebook-post', label: 'Facebook Post', width: 1200, height: 1200, ratio: '1:1' },
  { id: 'facebook-cover', label: 'Facebook Cover', width: 1640, height: 624, ratio: '21:9' },
  { id: 'youtube-thumbnail', label: 'YouTube Thumbnail', width: 1280, height: 720, ratio: '16:9' },
  { id: 'youtube-community', label: 'YouTube Community Post', width: 1080, height: 1350, ratio: '4:5' },
  { id: 'promotional-banner', label: 'Promotional Banner', width: 1920, height: 823, ratio: '21:9' },
] as const

export const SUPPORTED_RATIOS = [
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '16:10', '10:16', '21:9',
] as const

export const SUPPORTED_IMAGE_SIZES = ['1K', '2K', '4K'] as const

// Verified against the official Gemini Developer API pricing page on 2026-11-20:
// https://ai.google.dev/gemini-api/docs/pricing#gemini-nano-banana-2.1
export const CREATIVE_IMAGE_PRICING: CreativeImagePricing = {
  currency: 'USD',
  standardPerMillionOutputTokens: 30,
  batchPerMillionOutputTokens: 15,
  estimatedPerImage: { '1K': 0.0336, '2K': 0.0504, '4K': 0.113 },
  freeTierImageGeneration: false,
  source: 'https://ai.google.dev/gemini-api/docs/pricing#gemini-nano-banana-2.1',
  note: 'Gemini Nano Banana 2.1 image output: $30 per 1M tokens on the paid Standard tier. Image generation is not available on the Free tier.',
}

export const CREATIVE_PALETTES = [
  { id: 'black-gold', label: 'Black & Gold', primary: '#08090b', secondary: '#17191d', accent: '#d4af37', text: '#ffffff', muted: '#c8bd9e' },
  { id: 'navy-gold', label: 'Navy & Gold', primary: '#0a1730', secondary: '#102445', accent: '#e3b84a', text: '#ffffff', muted: '#bfcbe0' },
  { id: 'red-black', label: 'Red & Black', primary: '#130708', secondary: '#2b0b0e', accent: '#ff3b3b', text: '#ffffff', muted: '#e3b8b8' },
  { id: 'blue-white', label: 'Blue & White', primary: '#0b3d91', secondary: '#e8f2ff', accent: '#3aa0ff', text: '#ffffff', muted: '#d9e8ff' },
  { id: 'purple-neon', label: 'Purple & Neon', primary: '#120424', secondary: '#2d0a52', accent: '#c77dff', text: '#ffffff', muted: '#e0cbff' },
  { id: 'orange-black', label: 'Orange & Black', primary: '#0d0c0b', secondary: '#26160b', accent: '#ff8a1f', text: '#ffffff', muted: '#efd0b3' },
  { id: 'green-white', label: 'Green & White', primary: '#064e3b', secondary: '#f1f8f5', accent: '#2ecc71', text: '#ffffff', muted: '#d9efe8' },
  { id: 'silver-black', label: 'Silver & Black', primary: '#090a0c', secondary: '#25282d', accent: '#d7dde5', text: '#ffffff', muted: '#c2c9d2' },
] as const

export const CREATIVE_FONTS = [
  'Inter', 'Montserrat', 'Orbitron', 'Playfair Display', 'Cinzel', 'Anton',
  'Bebas Neue', 'Space Grotesk', 'Outfit', 'DM Sans', 'Georgia', 'Arial Black',
] as const

export const CREATIVE_LAYOUTS = [
  'centred-hero', 'split-left', 'split-right', 'cinematic-low', 'magazine-diagonal',
  'minimal-frame', 'neo-brutalist', 'luxury-column', 'editorial-grid', 'spotlight-stage',
] as const

const CONCEPT_DIRECTIONS = [
  'centred hero composition with a dramatic symmetrical frame and generous negative space at the top',
  'editorial split composition with a wide negative-space panel on the left and the main subject on the right',
  'low-angle cinematic composition with sweeping light trails and a deep atmospheric background',
  'premium magazine composition with layered geometric shapes, diagonal energy and a clean title-safe zone',
] as const

const JSON_SYSTEM_PROMPT = [
  'You are the creative planning engine for AG AI Creative Studio.',
  'Return ONLY one raw JSON object. No markdown, no code fences, no commentary.',
  'You may invent creative direction, copy, colour palettes and layouts.',
  'You must NEVER invent business facts: no phone numbers, email addresses, websites, addresses, social handles, prices, credentials, awards or contact details that were not explicitly supplied.',
  'If a business fact is missing, put a short English description of the missing fact in missingFacts and leave the related copy field empty.',
  'All colour values must be lowercase hex strings like #d4af37.',
].join(' ')

export function creativeCatalog(): CreativeCatalogResponse {
  return {
    categories: [...CREATIVE_CATEGORIES],
    tools: CREATIVE_TOOLS.map((tool) => ({
      id: tool.id,
      label: tool.label,
      defaultSize: tool.defaultSize as CreativeCatalogResponse['tools'][number]['defaultSize'],
    })),
    styles: [...CREATIVE_STYLES],
    sizes: CREATIVE_SIZES.map((size) => ({
      id: size.id,
      label: size.label,
      width: size.width,
      height: size.height,
      ratio: size.ratio,
    })),
    palettes: CREATIVE_PALETTES.map((palette) => ({ ...palette })),
    fonts: [...CREATIVE_FONTS],
    layouts: [...CREATIVE_LAYOUTS],
  }
}

export function creativeConfig(): CreativeConfigResponse {
  const chain = creativeImageProviders()
  const provider = chain[0]?.id ?? 'none'
  const message = !chain.length
    ? 'AI image generation is not configured. Set CREATIVE_IMAGE_PROVIDER=gemini with CREATIVE_IMAGE_API_KEY (Gemini), or configure OPENAI_IMAGE_API_KEY for the automatic OpenAI fallback. You can still upload your own background artwork.'
    : undefined
  const llmConfigured = config.llmKey.length > 0 && config.llmProvider !== 'none'
  const capabilities: CreativeCapability[] = [
    {
      operation: 'text-generation',
      provider: config.llmProvider || 'none',
      model: config.llmModel,
      configured: llmConfigured,
    },
    {
      operation: 'image-analysis',
      provider: config.llmProvider || 'none',
      model: config.visionModel || '(VISION_MODEL not set)',
      configured: llmConfigured && config.visionModel.length > 0,
      note: config.visionModel ? undefined : 'Set VISION_MODEL to a vision-capable model to unlock screenshot analysis.',
    },
    {
      operation: 'video-frame-analysis',
      provider: config.llmProvider || 'none',
      model: config.visionModel || '(VISION_MODEL not set)',
      configured: llmConfigured && config.visionModel.length > 0,
      note: 'Video is decoded in the browser; each sampled frame is analyzed with the vision model.',
    },
    {
      operation: 'image-generation',
      provider: chain.map((item) => item.id).join(' -> ') || 'none',
      model: chain.map((item) => item.model).join(' -> ') || '(not configured)',
      configured: chain.length > 0,
    },
  ]
  return {
    available: true,
    provider,
    imageProvider: provider,
    supportedImageProviders: [...supportedCreativeImageProviders],
    imageModel: chain[0]?.model ?? config.creativeImageModel,
    imageGeneration: chain.length > 0,
    logoRemoval: true,
    logoRemovalMode: hasRemoveBg() ? 'api' : 'precision-local',
    capabilities,
    supportedRatios: [...SUPPORTED_RATIOS],
    supportedImageSizes: [...SUPPORTED_IMAGE_SIZES],
    exportFormats: ['PNG', 'JPG'],
    maxExportDimension: 4096,
    maxExportPixels: 16_000_000,
    storage: 'server-json-files',
    pricing: { ...CREATIVE_IMAGE_PRICING, estimatedPerImage: { ...CREATIVE_IMAGE_PRICING.estimatedPerImage } },
    message,
  }
}

export function nearestAspectRatio(width: number, height: number): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return '4:5'
  const target = width / height
  let best: string = SUPPORTED_RATIOS[0]
  let bestDelta = Number.POSITIVE_INFINITY
  for (const ratio of SUPPORTED_RATIOS) {
    const [a, b] = ratio.split(':').map(Number)
    const delta = Math.abs(a / b - target)
    if (delta < bestDelta) {
      best = ratio
      bestDelta = delta
    }
  }
  return best
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  const candidates = [trimmed]
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fenced) candidates.push(fenced[1].trim())
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1))
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate)
    } catch {
      // try the next strategy
    }
  }
  throw new Error('The AI planner did not return valid JSON.')
}

const asRecord = (value: unknown) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
)

const text = (value: unknown, max = 240) => (
  typeof value === 'string' ? value.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : ''
)

const hex = (value: unknown, fallback: string) => (
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : fallback
)

export function parseBriefResponse(raw: string): CreativeBriefPlan {
  const body = asRecord(extractJson(raw))
  if (typeof body.category !== 'string' || !body.category.trim()) {
    throw new Error('The AI planner response had no category.')
  }
  const palette = asRecord(body.palette)
  const missing = Array.isArray(body.missingFacts)
    ? body.missingFacts.filter((item): item is string => typeof item === 'string').slice(0, 12).map((item) => text(item, 120))
    : []

  return {
    category: text(body.category, 80),
    customCategory: text(body.customCategory, 80),
    purpose: text(body.purpose, 160),
    style: text(body.style, 60) || 'Ultra Luxury',
    layout: text(body.layout, 60) || 'centred-hero',
    palette: {
      primary: hex(palette.primary, '#8b0000'),
      secondary: hex(palette.secondary, '#111111'),
      accent: hex(palette.accent, '#d4af37'),
      text: hex(palette.text, '#ffffff'),
      muted: hex(palette.muted, '#b9b0b0'),
    },
    headline: text(body.headline, 120),
    subtitle: text(body.subtitle, 180),
    cta: text(body.cta, 100),
    slogan: text(body.slogan, 140),
    description: text(body.description, 500),
    services: text(body.services, 400),
    missingFacts: missing,
    rationale: text(body.rationale, 300),
  }
}

export function buildBriefPrompt(args: {
  request: string
  tool: string
  categoryHint: string
  profile: Record<string, string>
}): string {
  return [
    `User request: ${args.request}`,
    `Requested tool: ${args.tool}`,
    `Category hint: ${args.categoryHint || 'none'}`,
    'Available categories: ' + CREATIVE_CATEGORIES.join(', '),
    'Available styles: ' + CREATIVE_STYLES.join(', '),
    'Business facts supplied by the user (use ONLY these, do not add to them):',
    JSON.stringify(args.profile, null, 2),
    '',
    'Return JSON with exactly these keys:',
    'category, customCategory, purpose, style, layout, palette, headline, subtitle, cta, slogan, description, services, missingFacts, rationale',
    'palette must be an object with primary, secondary, accent, text, muted hex colours.',
    'Choose category from the available list, or set "Custom Category" and fill customCategory.',
    'Write a compelling but truthful headline, subtitle and call-to-action. Never state guarantees.',
  ].join('\n')
}

export function buildImagePrompt(args: {
  category: string
  purpose: string
  style: string
  layout: string
  palette: { primary: string; secondary: string; accent: string }
  concept: number
  extra?: string
}): string {
  const direction = CONCEPT_DIRECTIONS[Math.max(0, Math.min(3, args.concept - 1))]
  return [
    `Create a premium advertising background/artwork for a ${args.category} project.`,
    `Purpose: ${args.purpose || 'professional promotional poster'}.`,
    `Design style: ${args.style}. Composition direction: ${args.layout}.`,
    `Concept ${args.concept} of 4: ${direction}.`,
    `Colour direction: primary ${args.palette.primary}, secondary ${args.palette.secondary}, accent ${args.palette.accent}.`,
    args.extra ? `Additional direction: ${args.extra}` : '',
    'Create cinematic lighting, refined materials, elegant depth and visible craft.',
    'CRITICAL: Do not render any text, letters, numbers, logos, brands, watermarks, phone numbers or contact details. All text will be added later by a precise compositor.',
    'Leave clean title-safe negative space suitable for overlay text. No mockups, no borders, no frame.',
  ].filter(Boolean).join(' ')
}

type GeminiImagePart = { type?: string; data?: string; mime_type?: string }

type GeminiImageBody = {
  output_image?: GeminiImagePart
  interaction?: { output_image?: GeminiImagePart; steps?: Array<{ content?: GeminiImagePart[] }> }
  steps?: Array<{ content?: GeminiImagePart[] }>
  error?: {
    code?: string | number
    message?: string
    details?: Array<{ quotaValue?: string | number; quotaId?: string }>
  }
}

export function extractGeneratedImage(body: GeminiImageBody): { data: Buffer; mime: string } | null {
  const candidates: GeminiImagePart[] = []
  if (body.output_image) candidates.push(body.output_image)
  if (body.interaction?.output_image) candidates.push(body.interaction.output_image)
  for (const step of body.steps ?? body.interaction?.steps ?? []) {
    for (const part of step.content ?? []) {
      if (part.type === 'image' || part.data) candidates.push(part)
    }
  }
  const part = candidates.find((item) => typeof item.data === 'string' && item.data.length > 100)
  if (!part?.data) return null
  const data = Buffer.from(part.data, 'base64')
  if (data.length < 1024) return null
  return { data, mime: part.mime_type || 'image/jpeg' }
}

export class CreativeImageApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly quota: CreativeQuotaState,
    readonly retryable = false,
  ) {
    super(message)
    this.name = 'CreativeImageApiError'
  }
}

export function parseGeminiFailure(status: number, body: unknown): { message: string; quota: CreativeQuotaState } {
  const source = body && typeof body === 'object' ? body as GeminiImageBody : {}
  const detail = source.error?.details?.find((item) => item.quotaValue !== undefined)
  const quotaValue = detail?.quotaValue
  const message = (source.error?.message || `Gemini API request failed with HTTP ${status}`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600)
  if (status === 429) {
    return {
      message: quotaValue !== undefined ? `${message} (quota: ${quotaValue})` : message,
      quota: 'exhausted',
    }
  }
  if (status === 404) return { message: `The configured Gemini model was not found. ${message}`, quota: 'unavailable' }
  return { message, quota: 'unknown' }
}

/** A bounded retry only for transient failures; quota/model errors are never retried. */
async function withRetry<T>(label: string, run: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      const retryable = error instanceof CreativeImageApiError
        ? error.retryable
        : /timeout|timed out|aborted|network|fetch failed|socket/i.test(error instanceof Error ? error.message : '')
      if (!retryable || attempt === attempts) break
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)))
    }
  }
  if (lastError instanceof Error) throw lastError
  throw new Error(`${label} failed after ${attempts} attempt(s).`)
}

async function providerFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
}

async function geminiRequest(url: string, init: RequestInit, timeoutMs = 180_000): Promise<{ response: Response; body: GeminiImageBody }> {
  const response = await providerFetch(url, init, timeoutMs)
  const raw = await response.text()
  let body: GeminiImageBody = {}
  try {
    body = JSON.parse(raw) as GeminiImageBody
  } catch {
    body = {}
  }
  return { response, body }
}

function imagePricing(): CreativeImagePricing {
  return { ...CREATIVE_IMAGE_PRICING, estimatedPerImage: { ...CREATIVE_IMAGE_PRICING.estimatedPerImage } }
}

type ProviderCheck = { modelAvailable: boolean; quota: CreativeQuotaState; detail: string }
type GeneratedImage = { data: Buffer; mime: string; model: string; provider: 'gemini' | 'openai' }
type GenerateArgs = { prompt: string; ratio: string; size: string; source?: { data: Buffer; mime: string } }

function failStatus(status: number): CreativeQuotaState {
  if (status === 429) return 'exhausted'
  if (status === 401 || status === 403 || status === 404) return 'unavailable'
  return 'unknown'
}

async function checkGeminiProvider(provider: ConfiguredImageProvider): Promise<ProviderCheck> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}`
  const { response, body } = await geminiRequest(endpoint, {
    headers: { 'x-goog-api-key': provider.key },
  }, 30_000)
  if (!response.ok) {
    return { modelAvailable: false, quota: failStatus(response.status), detail: parseGeminiFailure(response.status, body).message }
  }
  // A minimal text-only interaction proves the image model can accept work
  // without generating (or paying for) a full image.
  const probe = await geminiRequest('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': provider.key,
      'Api-Revision': '2026-05-20',
    },
    body: JSON.stringify({
      model: provider.model,
      input: [{ type: 'text', text: 'Reply with the single word OK.' }],
      store: false,
    }),
  }, 30_000)
  if (probe.response.ok) {
    return { modelAvailable: true, quota: 'ready', detail: `Gemini (${provider.model}) accepted a preflight request. Image quota is available.` }
  }
  const parsed = parseGeminiFailure(probe.response.status, probe.body)
  return { modelAvailable: true, quota: parsed.quota === 'exhausted' ? 'exhausted' : 'unknown', detail: parsed.message }
}

async function checkOpenAiProvider(provider: ConfiguredImageProvider): Promise<ProviderCheck> {
  const response = await providerFetch(
    `https://api.openai.com/v1/models/${encodeURIComponent(provider.model)}`,
    { headers: { Authorization: `Bearer ${provider.key}` } },
    30_000,
  )
  const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
  if (response.ok) {
    return { modelAvailable: true, quota: 'ready', detail: `OpenAI (${provider.model}) is reachable and the model is available.` }
  }
  const detail = body.error?.message || `OpenAI returned HTTP ${response.status}.`
  return { modelAvailable: response.status !== 404, quota: failStatus(response.status), detail: detail.slice(0, 600) }
}

async function checkProvider(provider: ConfiguredImageProvider): Promise<ProviderCheck> {
  return provider.id === 'gemini' ? checkGeminiProvider(provider) : checkOpenAiProvider(provider)
}

const PREFLIGHT_TTL_MS = 60_000
let preflightCache: { key: string; expiresAt: number; result: CreativeImagePreflight } | null = null

function chainFingerprint(chain: ConfiguredImageProvider[]): string {
  return createHash('sha256')
    .update(chain.map((item) => `${item.id}:${item.model}:${item.key}`).join('|'))
    .digest('hex')
    .slice(0, 12)
}

export async function creativeImagePreflight(force = false): Promise<CreativeImagePreflight> {
  const chain = creativeImageProviders()
  const base = {
    provider: (chain[0]?.id ?? 'none') as CreativeImagePreflight['provider'],
    model: chain[0]?.model ?? config.creativeImageModel,
    pricing: imagePricing(),
    checkedAt: new Date().toISOString(),
    providers: [] as CreativeProviderStatus[],
  }
  if (!chain.length) {
    return {
      ...base,
      modelAvailable: false,
      quota: 'unavailable',
      available: false,
      detail: 'No image provider is configured. Add CREATIVE_IMAGE_API_KEY for Gemini or OPENAI_IMAGE_API_KEY for the automatic fallback. Uploaded artwork still works.',
    }
  }

  const cacheKey = chainFingerprint(chain)
  const now = Date.now()
  if (!force && preflightCache && preflightCache.key === cacheKey && preflightCache.expiresAt > now) {
    return preflightCache.result
  }

  const statuses: CreativeProviderStatus[] = []
  for (const provider of chain) {
    try {
      const check = await checkProvider(provider)
      statuses.push({
        provider: provider.id,
        model: provider.model,
        role: provider.role,
        configured: true,
        modelAvailable: check.modelAvailable,
        quota: check.quota,
        available: check.quota === 'ready',
        detail: check.detail,
      })
    } catch (error) {
      statuses.push({
        provider: provider.id,
        model: provider.model,
        role: provider.role,
        configured: true,
        modelAvailable: false,
        quota: 'unknown',
        available: false,
        detail: `Preflight check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      })
    }
  }

  const selected = statuses.find((item) => item.available)
  const detail = selected
    ? selected.detail
    : statuses.map((item) => `${item.provider} (${item.model}): ${item.detail}`).join(' | ')
  const result: CreativeImagePreflight = {
    ...base,
    provider: selected?.provider ?? statuses[0]?.provider ?? 'none',
    model: selected?.model ?? base.model,
    modelAvailable: !!selected,
    quota: selected?.quota ?? statuses[0]?.quota ?? 'unknown',
    available: !!selected,
    detail,
    providers: statuses,
  }
  preflightCache = { key: cacheKey, expiresAt: Date.now() + PREFLIGHT_TTL_MS, result }
  return result
}

export async function assertCreativeImageReady(): Promise<void> {
  const state = await creativeImagePreflight()
  if (!state.available) {
    throw new CreativeImageApiError(
      `Image generation is unavailable: ${state.detail} No placeholder image was created.`,
      state.quota === 'exhausted' ? 429 : 0,
      state.quota,
    )
  }
}

function openAiSize(ratio: string): string {
  const value = (SUPPORTED_RATIOS as readonly string[]).includes(ratio) ? ratio : '4:5'
  const [width, height] = value.split(':').map(Number)
  const aspect = width / height
  if (aspect >= 1.3) return '1536x1024'
  if (aspect <= 0.8) return '1024x1536'
  return '1024x1024'
}

async function callGeminiImage(provider: ConfiguredImageProvider, args: GenerateArgs): Promise<GeneratedImage> {
  const input: Array<Record<string, string>> = []
  if (args.source) {
    input.push({
      type: 'image',
      data: args.source.data.toString('base64'),
      mime_type: args.source.mime === 'image/png' ? 'image/png' : 'image/jpeg',
    })
  }
  input.push({ type: 'text', text: args.prompt })
  const ratio = (SUPPORTED_RATIOS as readonly string[]).includes(args.ratio) ? args.ratio : '4:5'
  const imageSize = (SUPPORTED_IMAGE_SIZES as readonly string[]).includes(args.size) ? args.size : '1K'
  const { response, body } = await geminiRequest('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': provider.key,
      'Api-Revision': '2026-05-20',
    },
    body: JSON.stringify({
      model: provider.model,
      input,
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: ratio, image_size: imageSize },
      store: false,
    }),
  })
  if (!response.ok) {
    const parsed = parseGeminiFailure(response.status, body)
    throw new CreativeImageApiError(
      `Gemini (${provider.model}): ${parsed.message}`,
      response.status,
      parsed.quota,
      response.status === 408 || response.status >= 500,
    )
  }
  const image = extractGeneratedImage(body)
  if (!image) throw new Error(`Gemini (${provider.model}) returned no image data. No poster background was produced.`)
  return { ...image, model: provider.model, provider: 'gemini' }
}

async function callOpenAiImage(provider: ConfiguredImageProvider, args: GenerateArgs): Promise<GeneratedImage> {
  const size = openAiSize(args.ratio)
  const headers = { Authorization: `Bearer ${provider.key}` }
  let response: Response
  if (args.source) {
    const form = new FormData()
    form.append('model', provider.model)
    form.append('prompt', args.prompt)
    form.append('size', size)
    form.append('n', '1')
    form.append('output_format', 'png')
    const extension = args.source.mime === 'image/png' ? 'png' : 'jpg'
    form.append('image', new Blob([Uint8Array.from(args.source.data)], { type: args.source.mime }), `source.${extension}`)
    response = await providerFetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers, body: form }, 180_000)
  } else {
    response = await providerFetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: provider.model,
        prompt: args.prompt,
        size,
        n: 1,
        output_format: 'png',
        quality: args.size === '4K' ? 'high' : 'medium',
      }),
    }, 180_000)
  }
  const body = await response.json().catch(() => ({})) as {
    data?: Array<{ b64_json?: string; url?: string }>
    error?: { message?: string }
  }
  if (!response.ok) {
    const message = body.error?.message || `OpenAI returned HTTP ${response.status}.`
    throw new CreativeImageApiError(
      `OpenAI (${provider.model}): ${message.slice(0, 600)}`,
      response.status,
      failStatus(response.status),
      response.status === 408 || response.status === 429 || response.status >= 500,
    )
  }
  const first = body.data?.[0]
  let data: Buffer | null = first?.b64_json ? Buffer.from(first.b64_json, 'base64') : null
  let mime = 'image/png'
  if (!data && first?.url) {
    const downloaded = await providerFetch(first.url, {}, 60_000)
    if (!downloaded.ok) throw new Error(`OpenAI returned an image URL that could not be downloaded (HTTP ${downloaded.status}).`)
    data = Buffer.from(await downloaded.arrayBuffer())
    mime = downloaded.headers.get('content-type')?.split(';')[0] || 'image/png'
  }
  if (!data || data.length < 1024) throw new Error(`OpenAI (${provider.model}) returned no usable image data.`)
  if (data[0] === 0xff && data[1] === 0xd8) mime = 'image/jpeg'
  return { data, mime, model: provider.model, provider: 'openai' }
}

/**
 * Preflight availability decides the attempt order, not whether a configured
 * provider is skipped. A stale/false-negative availability check must never
 * block a real fallback, and no placeholder is ever produced on failure.
 */
export async function generateCreativeImage(args: GenerateArgs): Promise<GeneratedImage> {
  const state = await creativeImagePreflight()
  const availability = new Map(state.providers?.map((item) => [item.provider, item.available]) ?? [])
  const chain = creativeImageProviders().sort((a, b) =>
    Number(availability.get(b.id) === true) - Number(availability.get(a.id) === true),
  )
  if (!chain.length) {
    throw new CreativeImageApiError(
      `No image provider is configured: ${state.detail} No placeholder image was created.`,
      state.quota === 'exhausted' ? 429 : 0,
      state.quota,
    )
  }
  const failures: string[] = []
  for (const provider of chain) {
    try {
      return await withRetry(`${provider.id} image generation`, () => (
        provider.id === 'gemini' ? callGeminiImage(provider, args) : callOpenAiImage(provider, args)
      ))
    } catch (error) {
      failures.push(error instanceof Error ? error.message : 'unknown error')
      // A failed provider may have lost quota or access; the next call must
      // not reuse a stale readiness result.
      preflightCache = null
    }
  }
  throw new CreativeImageApiError(
    `Every configured image provider failed. ${failures.join(' | ')} No placeholder image was created.`,
    0,
    'unknown',
  )
}

export async function generateBrief(args: {
  request: string
  tool: string
  categoryHint: string
  profile: Record<string, string>
}): Promise<CreativeBriefPlan> {
  const completion = await askLlm({
    system: JSON_SYSTEM_PROMPT,
    prompt: buildBriefPrompt(args),
    maxTokens: 1600,
  })
  if (!completion.configured || completion.error || !completion.text.trim()) {
    throw new Error(completion.error || 'The AI planner is unavailable. No design plan was produced.')
  }
  return parseBriefResponse(completion.text)
}

export async function generateTextAsset(args: {
  system: string
  prompt: string
}): Promise<string> {
  const completion = await askLlm({ system: args.system, prompt: args.prompt, maxTokens: 900 })
  if (!completion.configured || completion.error || !completion.text.trim()) {
    throw new Error(completion.error || 'The AI text service is unavailable. No text was produced.')
  }
  return completion.text.replace(/\*\*/g, '').trim().slice(0, 3000)
}
