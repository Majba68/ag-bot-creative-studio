import assert from 'node:assert/strict'
import test from 'node:test'
import { creativeImageProviders } from '../../config.js'
import {
  buildImagePrompt, creativeCatalog, creativeConfig, CREATIVE_IMAGE_PRICING, extractGeneratedImage,
  nearestAspectRatio, parseBriefResponse, parseGeminiFailure,
} from '../creativeImage.js'
import { decodePng, encodePng, removeLogoBackground } from '../creativePng.js'

test('creative config advertises only supported capabilities and no keys', () => {
  const config = creativeConfig()
  assert.equal(config.storage, 'server-json-files')
  assert.deepEqual(config.exportFormats, ['PNG', 'JPG'])
  assert.equal(config.maxExportDimension, 4096)
  assert.equal(config.maxExportPixels, 16_000_000)
  assert.ok(config.supportedRatios.includes('4:5'))
  assert.ok(config.supportedImageSizes.includes('2K'))
  // Environment variable names may appear in setup guidance, but no key values may leak.
  assert.ok(!JSON.stringify(config).includes('AIza'))
  assert.ok(!JSON.stringify(config).includes('sk-'))
  assert.deepEqual(config.supportedImageProviders, ['gemini', 'openai'])
  assert.equal(config.imageGeneration, creativeImageProviders().length > 0)
  assert.ok(creativeImageProviders().every((provider) => provider.id === 'gemini' || provider.id === 'openai'))
})

test('creative config exposes all four real capability checks', () => {
  const capabilities = creativeConfig().capabilities ?? []
  assert.deepEqual(capabilities.map((item) => item.operation), [
    'text-generation', 'image-analysis', 'video-frame-analysis', 'image-generation',
  ])
  assert.ok(capabilities.every((item) => typeof item.configured === 'boolean'))
  assert.equal(capabilities[1].configured, capabilities[2].configured)
  if (!capabilities[1].configured) assert.match(capabilities[1].model, /VISION_MODEL/)
  assert.ok(!JSON.stringify(capabilities).includes('sk-'))
})

test('official Gemini image pricing is exposed with verified numbers', () => {
  const pricing = creativeConfig().pricing
  assert.equal(pricing.currency, 'USD')
  assert.equal(pricing.standardPerMillionOutputTokens, 30)
  assert.equal(pricing.batchPerMillionOutputTokens, 15)
  assert.equal(pricing.estimatedPerImage['1K'], 0.0336)
  assert.equal(pricing.estimatedPerImage['2K'], 0.0504)
  assert.equal(pricing.estimatedPerImage['4K'], 0.113)
  assert.equal(pricing.freeTierImageGeneration, false)
  assert.match(pricing.source, /ai\.google\.dev\/gemini-api\/docs\/pricing/)
  assert.deepEqual(CREATIVE_IMAGE_PRICING.estimatedPerImage, pricing.estimatedPerImage)
})

test('Gemini failures are classified honestly for preflight and generation', () => {
  const quota = parseGeminiFailure(429, {
    error: {
      message: 'Rate limit exceeded for model gemini-nano-banana-2.1 (limit: 0 input tokens per minute on Free Tier).',
      details: [{ quotaValue: '0' }],
    },
  })
  assert.equal(quota.quota, 'exhausted')
  assert.match(quota.message, /limit: 0/)
  assert.match(quota.message, /quota: 0/)
  const missing = parseGeminiFailure(404, { error: { message: 'Model not found' } })
  assert.equal(missing.quota, 'unavailable')
  assert.match(missing.message, /not found/i)
})

test('creative catalog contains all required categories, tools and styles', () => {
  const catalog = creativeCatalog()
  assert.equal(catalog.tools.length, 20)
  assert.ok(catalog.categories.includes('Plumbing Services'))
  assert.ok(catalog.categories.includes('Custom Category'))
  assert.ok(catalog.styles.includes('Ultra Luxury'))
  assert.ok(catalog.palettes.some((palette) => palette.label === 'Black & Gold'))
})

test('nearest aspect ratio chooses a supported image ratio', () => {
  assert.equal(nearestAspectRatio(1080, 1350), '4:5')
  assert.equal(nearestAspectRatio(1920, 1080), '16:9')
  assert.equal(nearestAspectRatio(1000, 1000), '1:1')
  assert.equal(nearestAspectRatio(0, 0), '4:5')
})

test('brief parser accepts fenced JSON and preserves missing business facts', () => {
  const raw = [
    '```json',
    JSON.stringify({
      category: 'Restaurant',
      purpose: 'luxury food campaign',
      style: 'Ultra Luxury',
      layout: 'centred-hero',
      palette: { primary: '#101010', secondary: '#222222', accent: '#d4af37', text: '#ffffff', muted: '#cccccc' },
      headline: 'Taste the exceptional',
      subtitle: 'A premium dining experience',
      cta: 'Reserve your table',
      slogan: '',
      description: '',
      services: '',
      missingFacts: ['phone number'],
      rationale: 'Warm premium direction',
    }),
    '```',
  ].join('\n')
  const plan = parseBriefResponse(raw)
  assert.equal(plan.category, 'Restaurant')
  assert.equal(plan.palette.accent, '#d4af37')
  assert.deepEqual(plan.missingFacts, ['phone number'])
  assert.equal(plan.headline, 'Taste the exceptional')
})

test('image prompt forbids text and contact details', () => {
  const prompt = buildImagePrompt({
    category: 'Plumbing Services',
    purpose: 'premium advertisement',
    style: 'Ultra Luxury',
    layout: 'centred-hero',
    palette: { primary: '#000000', secondary: '#111111', accent: '#d4af37' },
    concept: 1,
  })
  assert.match(prompt, /do not render any text/i)
  assert.match(prompt, /phone numbers/i)
  assert.match(prompt, /CRITICAL/i)
})

test('generated image parser finds interaction step image data', () => {
  const image = extractGeneratedImage({
    steps: [{ content: [{ type: 'image', data: Buffer.alloc(2048, 7).toString('base64'), mime_type: 'image/jpeg' }] }],
  })
  assert.ok(image)
  assert.equal(image.mime, 'image/jpeg')
  assert.equal(image.data.length, 2048)
})

test('PNG encode/decode preserves original RGBA pixels', () => {
  const width = 8
  const height = 8
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = 12
    data[i * 4 + 1] = 34
    data[i * 4 + 2] = 56
    data[i * 4 + 3] = 200
  }
  const decoded = decodePng(encodePng(width, height, data))
  assert.equal(decoded.width, width)
  assert.equal(decoded.height, height)
  assert.deepEqual([...decoded.data.slice(0, 8)], [12, 34, 56, 200, 12, 34, 56, 200])
})

test('logo background removal only clears border background and keeps original logo RGB', () => {
  const width = 24
  const height = 24
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = 255
    data[i * 4 + 1] = 255
    data[i * 4 + 2] = 255
    data[i * 4 + 3] = 255
  }
  for (let y = 7; y < 17; y += 1) {
    for (let x = 7; x < 17; x += 1) {
      const offset = (y * width + x) * 4
      data[offset] = 200
      data[offset + 1] = 20
      data[offset + 2] = 30
      data[offset + 3] = 255
    }
  }
  const result = removeLogoBackground(encodePng(width, height, data))
  const decoded = decodePng(result.buffer)
  const corner = (0 * 4) * 1
  const centre = (12 * width + 12) * 4
  assert.ok(result.removedPixels > 0)
  assert.equal(decoded.data[corner + 3], 0)
  assert.equal(decoded.data[centre], 200)
  assert.equal(decoded.data[centre + 1], 20)
  assert.equal(decoded.data[centre + 2], 30)
  assert.equal(decoded.data[centre + 3], 255)
})
