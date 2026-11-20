import 'dotenv/config'

const clean = (value: string | undefined) => (value ?? '').trim()

const providerName = clean(process.env.LLM_PROVIDER || 'none').toLowerCase()
const llmKeyValue = clean(process.env.LLM_API_KEY)
// Image generation is a separate, swappable provider. Google Gemini is the
// primary implementation; adding another provider only requires a new adapter.
const imageProviderName = clean(process.env.CREATIVE_IMAGE_PROVIDER || 'gemini').toLowerCase()
const fallbackImageProviderName = clean(process.env.CREATIVE_IMAGE_FALLBACK_PROVIDER || 'openai').toLowerCase()

export const config = {
  port: Number(process.env.PORT) || 3001,
  twelveDataKey: clean(process.env.TWELVEDATA_API_KEY),
  llmProvider: providerName,
  llmKey: llmKeyValue,
  creativeImageProvider: imageProviderName,
  creativeImageFallbackProvider: fallbackImageProviderName,
  // Creative Studio reuses the configured Gemini key by default. A separate key
  // can be supplied without exposing anything to the browser.
  creativeImageKey: clean(process.env.CREATIVE_IMAGE_API_KEY || process.env.POSTER_API_KEY) || llmKeyValue,
  creativeImageModel:
    clean(process.env.CREATIVE_IMAGE_MODEL || process.env.POSTER_IMAGE_MODEL) || 'gemini-nano-banana-2.1',
  // Genuine second image provider. Reuses LLM_API_KEY when LLM_PROVIDER=openai.
  openAiImageKey: clean(process.env.OPENAI_IMAGE_API_KEY) || (providerName === 'openai' ? llmKeyValue : ''),
  openAiImageModel: clean(process.env.OPENAI_IMAGE_MODEL) || 'gpt-image-1',
  removeBgKey: clean(process.env.REMOVEBG_API_KEY),
  llmModel: clean(process.env.LLM_MODEL) || (providerName === 'gemini' ? 'gemini-3.5-flash-lite' : 'gpt-4o-mini'),
  // Deliberately no default: the analyzer must be pointed at an explicitly
  // configured, vision-capable model before real screenshot analysis can run.
  visionModel: clean(process.env.VISION_MODEL),
  clientOrigin: clean(process.env.CLIENT_ORIGIN) || 'http://localhost:5173',
  demoMode: clean(process.env.DEMO_MODE).toLowerCase() === 'true',
  // TRAPO Store admin. With no ADMIN_PASSWORD the store is open for local demos.
  adminPassword: clean(process.env.ADMIN_PASSWORD),
  adminSecret: clean(process.env.ADMIN_SECRET),
}

export const hasMarketData = () => config.twelveDataKey.length > 0

export const llmProvider = (): 'openai' | 'anthropic' | 'gemini' | 'none' => {
  if (config.llmProvider === 'openai' || config.llmProvider === 'anthropic' || config.llmProvider === 'gemini') {
    return config.llmKey ? config.llmProvider : 'none'
  }
  return 'none'
}

export const hasLlm = () => llmProvider() !== 'none'

export const hasVision = () => hasLlm() && config.visionModel.length > 0

export type CreativeImageProviderId = 'gemini' | 'openai'

export const supportedCreativeImageProviders: CreativeImageProviderId[] = ['gemini', 'openai']

export type ConfiguredImageProvider = {
  id: CreativeImageProviderId
  model: string
  key: string
  role: 'primary' | 'fallback'
}

function configuredProvider(name: string, role: 'primary' | 'fallback'): ConfiguredImageProvider | null {
  if (name === 'gemini' && config.creativeImageKey && config.creativeImageModel) {
    return { id: 'gemini', model: config.creativeImageModel, key: config.creativeImageKey, role }
  }
  if (name === 'openai' && config.openAiImageKey && config.openAiImageModel) {
    return { id: 'openai', model: config.openAiImageModel, key: config.openAiImageKey, role }
  }
  return null
}

/** Ordered provider chain: explicitly selected primary first, then the fallback. */
export function creativeImageProviders(): ConfiguredImageProvider[] {
  const primary = configuredProvider(config.creativeImageProvider, 'primary')
  const fallback = configuredProvider(config.creativeImageFallbackProvider, 'fallback')
  const chain: ConfiguredImageProvider[] = []
  if (primary) chain.push(primary)
  if (fallback && fallback.id !== primary?.id) chain.push(fallback)
  return chain
}

export const hasCreativeImage = () => creativeImageProviders().length > 0

export const hasRemoveBg = () => config.removeBgKey.length > 0
