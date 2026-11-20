import type {
  BusinessProfile, BusinessProfileInput, CreativeBriefPlan, CreativeCatalogResponse,
  CreativeDesign, CreativeEffects, CreativeLayer, CreativeLayerType, CreativeQuality, CreativeSizeId,
} from '../types'

export const DEFAULT_PALETTE = {
  primary: '#08090b', secondary: '#17191d', accent: '#d4af37', text: '#ffffff', muted: '#c8bd9e',
}

export const DEFAULT_SIZES = [
  { id: 'instagram-portrait' as CreativeSizeId, label: 'Instagram Portrait', width: 1080, height: 1350, ratio: '4:5' },
  { id: 'instagram-square' as CreativeSizeId, label: 'Instagram Square', width: 1080, height: 1080, ratio: '1:1' },
  { id: 'instagram-story' as CreativeSizeId, label: 'Instagram Story', width: 1080, height: 1920, ratio: '9:16' },
  { id: 'facebook-post' as CreativeSizeId, label: 'Facebook Post', width: 1200, height: 1200, ratio: '1:1' },
  { id: 'facebook-cover' as CreativeSizeId, label: 'Facebook Cover', width: 1640, height: 624, ratio: '21:9' },
  { id: 'youtube-thumbnail' as CreativeSizeId, label: 'YouTube Thumbnail', width: 1280, height: 720, ratio: '16:9' },
  { id: 'youtube-community' as CreativeSizeId, label: 'YouTube Community Post', width: 1080, height: 1350, ratio: '4:5' },
  { id: 'promotional-banner' as CreativeSizeId, label: 'Promotional Banner', width: 1920, height: 823, ratio: '21:9' },
  { id: 'custom' as CreativeSizeId, label: 'Custom Dimensions', width: 1080, height: 1350, ratio: 'custom' },
]

export const EMPTY_PROFILE: BusinessProfileInput = {
  businessName: '', contact1: '', contact2: '', whatsapp: '', website: '', email: '',
  address: '', facebook: '', instagram: '', services: '', description: '', brandColors: '',
  slogan: '', logoAssetId: '', teamPhotoAssetId: '',
}

export const VISIBLE_FIELDS = [
  { key: 'headline', label: 'Headline' },
  { key: 'subtitle', label: 'Subtitle' },
  { key: 'businessName', label: 'Business name' },
  { key: 'logo', label: 'Logo' },
  { key: 'worker', label: 'Team / worker photo' },
  { key: 'slogan', label: 'Slogan' },
  { key: 'description', label: 'Description' },
  { key: 'services', label: 'Services' },
  { key: 'cta', label: 'Call to action' },
  { key: 'contact1', label: 'Contact 1' },
  { key: 'contact2', label: 'Contact 2' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'website', label: 'Website' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
] as const

export const DEFAULT_VISIBLE = ['headline', 'subtitle', 'businessName', 'logo', 'worker', 'slogan', 'cta', 'contact1', 'website'] as const

export function createDefaultDesign(): CreativeDesign {
  return {
    tool: 'poster',
    category: 'Custom Category',
    customCategory: '',
    brief: '',
    purpose: 'premium promotional poster',
    headline: 'Your next campaign starts here',
    subtitle: 'Designed with intelligence, built for attention',
    cta: 'Contact us today',
    slogan: '',
    description: '',
    services: '',
    sizeId: 'instagram-portrait',
    width: 1080,
    height: 1350,
    quality: 'HD',
    style: 'Ultra Luxury',
    layout: 'centred-hero',
    palette: { ...DEFAULT_PALETTE },
    backgroundAssetId: '',
    visibleFields: [...DEFAULT_VISIBLE],
    layers: [],
    effects: { gradient: true, lighting: true, shadows: true, threeD: false, graphics: true, scanlines: false },
    concept: 1,
  }
}

export function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

export function conceptPalette(plan: CreativeBriefPlan, concept: number, catalog: CreativeCatalogResponse | null) {
  const palettes = catalog?.palettes ?? []
  if (concept === 1) return { ...plan.palette }
  if (concept === 2 && palettes.length) return { ...palettes[hashString(plan.category) % palettes.length] }
  if (concept === 3) {
    return {
      primary: plan.palette.accent,
      secondary: plan.palette.primary,
      accent: plan.palette.secondary,
      text: plan.palette.text,
      muted: plan.palette.muted,
    }
  }
  if (palettes.length) return { ...palettes[(hashString(plan.category) + 3) % palettes.length] }
  return { ...plan.palette, accent: '#ff2e88' }
}

export function conceptStyle(plan: CreativeBriefPlan, concept: number, catalog: CreativeCatalogResponse | null): string {
  const styles = catalog?.styles ?? ['Ultra Luxury', 'Cinematic', 'Futuristic', 'Modern Editorial']
  if (concept === 1) return plan.style || styles[0]
  return styles[(hashString(plan.category) + concept * 3) % styles.length]
}

export function conceptLayout(plan: CreativeBriefPlan, concept: number, catalog: CreativeCatalogResponse | null): string {
  const layouts = catalog?.layouts ?? ['centred-hero', 'split-left', 'cinematic-low', 'magazine-diagonal']
  if (concept === 1) return plan.layout || layouts[0]
  return layouts[(hashString(plan.category) + concept * 2) % layouts.length]
}

export function conceptFont(plan: CreativeBriefPlan, concept: number, catalog: CreativeCatalogResponse | null): string {
  const fonts = catalog?.fonts ?? ['Inter', 'Montserrat', 'Orbitron', 'Playfair Display']
  return fonts[(hashString(plan.category + plan.style) + concept) % fonts.length]
}

/** Reference canvas the typography scale is authored against. */
export const DESIGN_REF_WIDTH = 1080
export const DESIGN_REF_HEIGHT = 1350

/** All generated layers stay inside this safe area (5.5% / 5% margins). */
export const SAFE_AREA = { left: 0.055, right: 0.945, top: 0.05, bottom: 0.95 }

/** Font sizes auto-scale with the poster size so small/banner formats stay readable. */
export function designScale(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1
  return Math.max(0.25, Math.min(2.5, Math.min(width / DESIGN_REF_WIDTH, height / DESIGN_REF_HEIGHT)))
}

type Zone = { x: number; y: number; w: number; h: number; align?: 'left' | 'center' | 'right'; radius?: number }

/** Base font sizes (at the reference canvas) for each text role. */
const BASE_FONT: Partial<Record<CreativeLayerType, number>> = {
  business: 26, headline: 60, subtitle: 27, slogan: 21, description: 17,
  services: 17, cta: 25, contact: 19, website: 16, email: 15, address: 14, social: 13,
}

const BASE_WEIGHT: Partial<Record<CreativeLayerType, number>> = {
  business: 700, headline: 800, subtitle: 500, slogan: 600, description: 400,
  services: 500, cta: 800, contact: 700, website: 500, email: 400, address: 400, social: 400,
}

/**
 * Four non-overlapping composition zones. Photo/logo rectangles never intersect
 * the text column, and every rectangle ends at or before the safe-area edge.
 */
function layoutZones(concept: number, hasWorker: boolean, hasLogo: boolean): {
  worker: Zone | null; logo: Zone | null; brand: Zone | null; text: Zone
} {
  const worker: Zone | null = hasWorker
    ? concept === 2
      ? { x: 0.06, y: 0.09, w: 0.38, h: 0.50, radius: 28 }
      : concept === 3
        ? { x: 0.40, y: 0.125, w: 0.20, h: 0.25, radius: 999 }
        : { x: concept === 4 ? 0.55 : 0.56, y: 0.09, w: concept === 4 ? 0.39 : 0.38, h: concept === 4 ? 0.52 : 0.48, radius: concept === 4 ? 18 : 22 }
    : null
  const logo: Zone | null = hasLogo
    ? concept === 2
      ? { x: 0.75, y: 0.055, w: 0.14, h: 0.075 }
      : concept === 3
        ? { x: 0.055, y: 0.055, w: 0.11, h: 0.06 }
        : { x: 0.06, y: 0.055, w: 0.14, h: 0.075 }
    : null
  const brand: Zone | null = concept === 3
    ? { x: 0.20, y: 0.055, w: 0.60, h: 0.05, align: 'center' }
    : null
  const text: Zone = concept === 3
    ? (worker ? { x: 0.10, y: 0.40, w: 0.80, h: 0.545, align: 'center' } : { x: 0.10, y: 0.16, w: 0.80, h: 0.785, align: 'center' })
    : concept === 2
      ? { x: 0.50, y: 0.16, w: 0.44, h: 0.79, align: 'left' }
      : { x: 0.06, y: 0.16, w: 0.43, h: 0.79, align: 'left' }
  return { worker, logo, brand, text }
}

type StyleTreatment = {
  font: string
  weight: number
  spacing: number
  effects: Partial<CreativeEffects>
}

const STYLE_TREATMENTS: Record<string, StyleTreatment> = {
  'Ultra Luxury': { font: 'Cinzel', weight: 700, spacing: 3, effects: { gradient: true, lighting: true, shadows: true, threeD: false, graphics: true, scanlines: false } },
  Cinematic: { font: 'Montserrat', weight: 800, spacing: -1, effects: { gradient: true, lighting: true, shadows: true, threeD: false, graphics: false, scanlines: false } },
  Futuristic: { font: 'Orbitron', weight: 700, spacing: 2, effects: { gradient: true, lighting: true, shadows: false, threeD: false, graphics: true, scanlines: true } },
  Minimalist: { font: 'Inter', weight: 500, spacing: 1, effects: { gradient: false, lighting: false, shadows: false, threeD: false, graphics: false, scanlines: false } },
  'Professional Corporate': { font: 'DM Sans', weight: 700, spacing: 0, effects: { gradient: false, lighting: false, shadows: true, threeD: false, graphics: false, scanlines: false } },
  '3D Premium': { font: 'Outfit', weight: 900, spacing: 0, effects: { gradient: true, lighting: true, shadows: true, threeD: true, graphics: true, scanlines: false } },
  'Dark Luxury': { font: 'Playfair Display', weight: 700, spacing: 2, effects: { gradient: true, lighting: true, shadows: true, threeD: false, graphics: false, scanlines: false } },
  Neon: { font: 'Orbitron', weight: 800, spacing: 2, effects: { gradient: true, lighting: true, shadows: true, threeD: false, graphics: true, scanlines: true } },
  'Modern Editorial': { font: 'Space Grotesk', weight: 700, spacing: -1, effects: { gradient: false, lighting: false, shadows: true, threeD: false, graphics: false, scanlines: false } },
  Photorealistic: { font: 'Inter', weight: 700, spacing: 0, effects: { gradient: true, lighting: true, shadows: true, threeD: false, graphics: false, scanlines: false } },
  'Magazine Style': { font: 'Playfair Display', weight: 800, spacing: -2, effects: { gradient: false, lighting: false, shadows: true, threeD: false, graphics: true, scanlines: false } },
  'Creative Artistic': { font: 'Outfit', weight: 800, spacing: 1, effects: { gradient: true, lighting: true, shadows: true, threeD: false, graphics: true, scanlines: false } },
  Glassmorphism: { font: 'DM Sans', weight: 500, spacing: 1, effects: { gradient: true, lighting: true, shadows: false, threeD: false, graphics: false, scanlines: false } },
  'Bold Advertisement': { font: 'Anton', weight: 900, spacing: 1, effects: { gradient: true, lighting: false, shadows: true, threeD: false, graphics: true, scanlines: false } },
}

const DEFAULT_STYLE_TREATMENT: StyleTreatment = {
  font: 'Inter', weight: 700, spacing: 0,
  effects: { gradient: true, lighting: true, shadows: true, threeD: false, graphics: true, scanlines: false },
}

export function applyDesignStyle(design: CreativeDesign, style: string): CreativeDesign {
  const treatment = STYLE_TREATMENTS[style] ?? DEFAULT_STYLE_TREATMENT
  return {
    ...design,
    style,
    effects: { ...design.effects, ...treatment.effects },
    layers: design.layers.map((layer) => {
      if (layer.text === undefined) return layer
      const primary = layer.role === 'primary'
      return {
        ...layer,
        fontFamily: `${treatment.font}, sans-serif`,
        weight: primary ? treatment.weight : Math.max(400, treatment.weight - 200),
        letterSpacing: primary ? treatment.spacing : Math.max(0, treatment.spacing - 1),
      }
    }),
  }
}

function visible(design: CreativeDesign, key: string): boolean {
  return design.visibleFields.includes(key)
}

function layerContent(design: CreativeDesign, profile: BusinessProfileInput | null): Partial<Record<CreativeLayerType, string>> {
  const content: Partial<Record<CreativeLayerType, string>> = {}
  const source = profile ?? EMPTY_PROFILE
  if (visible(design, 'headline')) content.headline = design.headline
  if (visible(design, 'subtitle')) content.subtitle = design.subtitle
  if (visible(design, 'businessName') && source.businessName.trim()) content.business = source.businessName
  if (visible(design, 'slogan')) content.slogan = source.slogan.trim() || design.slogan
  if (visible(design, 'description')) content.description = source.description.trim() || design.description
  if (visible(design, 'services')) content.services = source.services.trim() || design.services
  if (visible(design, 'cta')) content.cta = design.cta

  const contact = [
    visible(design, 'contact1') && source.contact1.trim() ? source.contact1.trim() : '',
    visible(design, 'contact2') && source.contact2.trim() ? source.contact2.trim() : '',
    visible(design, 'whatsapp') && source.whatsapp.trim() ? `WA ${source.whatsapp.trim()}` : '',
  ].filter(Boolean).join('  •  ')
  if (contact) content.contact = contact
  if (visible(design, 'website') && source.website.trim()) content.website = source.website
  if (visible(design, 'email') && source.email.trim()) content.email = source.email
  if (visible(design, 'address') && source.address.trim()) content.address = source.address
  const social = [
    visible(design, 'facebook') && source.facebook.trim() ? source.facebook.trim() : '',
    visible(design, 'instagram') && source.instagram.trim() ? source.instagram.trim() : '',
  ].filter(Boolean).join('  •  ')
  if (social) content.social = social
  return content
}

type ComposeOptions = {
  textOverrides?: CreativeLayer[]
  presentationFrom?: CreativeLayer[]
}

export function composeLayers(
  design: CreativeDesign,
  profile: BusinessProfileInput | null,
  concept = design.concept,
  fontFamily?: string,
  options: ComposeOptions = {},
): CreativeLayer[] {
  const content = layerContent(design, profile)
  const hasWorker = visible(design, 'worker') && !!profile?.teamPhotoAssetId
  const hasLogo = visible(design, 'logo') && !!profile?.logoAssetId
  const zones = layoutZones(concept, hasWorker, hasLogo)
  const width = design.width
  const height = design.height
  const scale = designScale(width, height)
  const layers: CreativeLayer[] = []

  if (zones.worker && hasWorker && profile?.teamPhotoAssetId) layers.push({
    id: 'layer-worker', type: 'worker', assetId: profile.teamPhotoAssetId,
    x: zones.worker.x, y: zones.worker.y, w: zones.worker.w, h: zones.worker.h,
    radius: zones.worker.radius ?? 22, opacity: 1,
  })
  if (zones.logo && hasLogo && profile?.logoAssetId) layers.push({
    id: 'layer-logo', type: 'logo', assetId: profile.logoAssetId,
    x: zones.logo.x, y: zones.logo.y, w: zones.logo.w, h: zones.logo.h,
    opacity: 1,
  })

  const roleOf = (type: CreativeLayerType): CreativeLayer['role'] =>
    type === 'headline' || type === 'business' ? 'primary'
      : type === 'cta' || type === 'contact' || type === 'slogan' ? 'accent' : 'secondary'
  const colorOf = (role: CreativeLayer['role']) =>
    role === 'accent' ? design.palette.accent : role === 'primary' ? design.palette.text : design.palette.muted

  if (zones.brand && content.business) layers.push({
    id: 'layer-business', type: 'business', text: content.business,
    x: zones.brand.x, y: zones.brand.y, w: zones.brand.w, h: zones.brand.h,
    fontSize: (BASE_FONT.business ?? 26) * scale, align: zones.brand.align ?? 'center',
    weight: BASE_WEIGHT.business ?? 700, letterSpacing: 2, lineHeight: 1.12,
    opacity: 1, fontFamily: fontFamily || 'Inter, Arial, sans-serif',
    color: design.palette.muted, role: 'primary',
  })

  const textOrder: CreativeLayerType[] = [
    'business', 'headline', 'subtitle', 'slogan', 'description', 'services',
    'cta', 'contact', 'website', 'email', 'address', 'social',
  ]
  const items = textOrder
    .filter((type) => !(type === 'business' && zones.brand) && !!content[type])
    .map((type) => ({ type, text: content[type] as string }))

  const gap = 0.007
  let fontScale = scale
  let bands: Array<{ type: CreativeLayerType; text: string; y: number; h: number; font: number }> = []
  for (let pass = 0; pass < 5; pass += 1) {
    bands = []
    let used = 0
    for (const item of items) {
      const font = (BASE_FONT[item.type] ?? 18) * fontScale
      const charsPerLine = Math.max(8, Math.floor((zones.text.w * width) / (font * 0.52)))
      const lines = Math.max(1, Math.min(8, Math.ceil(item.text.length / charsPerLine)))
      const h = (lines * font * 1.12) / height
      bands.push({ ...item, y: zones.text.y + used, h, font })
      used += h + gap
    }
    const contentHeight = used - (items.length ? gap : 0)
    if (!items.length || contentHeight <= zones.text.h) break
    fontScale *= Math.max(0.5, (zones.text.h / contentHeight) * 0.96)
  }
  if (bands.length) {
    const available = zones.text.h - gap * (bands.length - 1)
    const total = bands.reduce((sum, band) => sum + band.h, 0)
    const factor = total > available && total > 0 ? available / total : 1
    let cursor = zones.text.y
    for (const band of bands) {
      band.y = cursor
      band.h = Math.max(0.01, band.h * factor)
      cursor += band.h + gap
    }
  }

  for (const band of bands) {
    const role = roleOf(band.type)
    layers.push({
      id: `layer-${band.type}`,
      type: band.type,
      text: band.text,
      x: zones.text.x,
      y: band.y,
      w: zones.text.w,
      h: band.h,
      fontSize: band.font,
      align: zones.text.align ?? 'left',
      weight: BASE_WEIGHT[band.type] ?? 600,
      letterSpacing: 0,
      lineHeight: 1.12,
      opacity: 1,
      fontFamily: fontFamily || 'Inter, Arial, sans-serif',
      color: colorOf(role),
      role,
    })
  }

  const presentationKeys = ['fontFamily', 'fontSize', 'color', 'align', 'weight', 'letterSpacing', 'lineHeight', 'opacity'] as const
  if (!options.textOverrides?.length && !options.presentationFrom?.length) return layers
  return layers.map((layer) => {
    const textSource = options.textOverrides?.find((item) => item.id === layer.id)
    const presentationSource = options.presentationFrom?.find((item) => item.id === layer.id)
    const next = { ...layer }
    if (textSource?.text !== undefined) next.text = textSource.text
    if (presentationSource) {
      for (const key of presentationKeys) {
        const value = presentationSource[key]
        if (value !== undefined) Object.assign(next, { [key]: value })
      }
    }
    return next
  })
}

export function recolorLayers(design: CreativeDesign): CreativeLayer[] {
  return design.layers.map((layer) => {
    if (layer.type === 'worker' || layer.type === 'logo') return layer
    const role = layer.role ?? 'secondary'
    return {
      ...layer,
      color: role === 'accent' ? design.palette.accent : role === 'primary' ? design.palette.text : design.palette.muted,
    }
  })
}

export function buildBackgroundPrompt(args: {
  category: string
  purpose: string
  style: string
  layout: string
  palette: { primary: string; secondary: string; accent: string }
  concept: number
  seed: number
}): string {
  const directions = [
    'centred symmetrical hero composition with generous clean title-safe negative space at the top',
    'editorial split composition with a large quiet panel on the left and cinematic subject on the right',
    'low-angle atmospheric composition with depth, soft bokeh and a dramatic light source',
    'premium magazine composition with diagonal geometry, layered materials and a clean headline zone',
  ]
  return [
    `Create original premium advertising artwork for a ${args.category} project.`,
    `Purpose: ${args.purpose || 'professional promotional poster'}.`,
    `Style: ${args.style}. Composition: ${args.layout}.`,
    `Concept ${args.concept} of 4: ${directions[(args.concept - 1) % directions.length]}.`,
    `Colour direction: primary ${args.palette.primary}, secondary ${args.palette.secondary}, accent ${args.palette.accent}.`,
    `Creative variation seed ${args.seed}. Do not repeat a previous layout.`,
    'Use refined materials, cinematic lighting, elegant depth and visible craft.',
    'CRITICAL: no text, letters, numbers, logos, brands, watermarks, phone numbers, websites, addresses or contact details.',
    'Leave clean uninterrupted negative space for precise text compositing. No frame, no border, no mockup.',
  ].join(' ')
}

const QUALITY_LONG_EDGE: Record<CreativeQuality, number> = {
  HD: 1080, FULL_HD: 1920, '2K': 2560, '4K': 3840,
}

export function exportDimensions(
  width: number, height: number, quality: CreativeQuality,
  maxDimension = 4096, maxPixels = 16_000_000,
): { width: number; height: number } {
  const longEdge = Math.max(width, height)
  const target = Math.min(QUALITY_LONG_EDGE[quality], maxDimension, longEdge)
  const scale = target / longEdge
  let exportWidth = Math.max(1, Math.round(width * scale))
  let exportHeight = Math.max(1, Math.round(height * scale))
  if (exportWidth * exportHeight > maxPixels) {
    const reduction = Math.sqrt(maxPixels / (exportWidth * exportHeight))
    exportWidth = Math.max(1, Math.floor(exportWidth * reduction))
    exportHeight = Math.max(1, Math.floor(exportHeight * reduction))
  }
  return { width: exportWidth, height: exportHeight }
}

export function availableQualities(
  width: number, height: number, maxDimension = 4096, maxPixels = 16_000_000,
): CreativeQuality[] {
  return (['HD', 'FULL_HD', '2K', '4K'] as CreativeQuality[]).filter((quality) => {
    const size = exportDimensions(width, height, quality, maxDimension, maxPixels)
    return size.width <= maxDimension && size.height <= maxDimension && size.width * size.height <= maxPixels
  })
}

export function nearestRatio(width: number, height: number): string {
  const ratios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '16:10', '10:16', '21:9']
  const target = width / height
  return ratios.reduce((best, ratio) => {
    const [a, b] = ratio.split(':').map(Number)
    const currentDelta = Math.abs((Number(best.split(':')[0]) / Number(best.split(':')[1])) - target)
    const delta = Math.abs(a / b - target)
    return delta < currentDelta ? ratio : best
  }, '4:5')
}

export function profileFacts(profile: BusinessProfileInput | BusinessProfile | null): Record<string, string> {
  if (!profile) return {}
  return Object.fromEntries(
    Object.entries(profile)
      .filter(([key, value]) => typeof value === 'string' && value.trim() && !key.endsWith('AssetId'))
      .map(([key, value]) => [key, String(value).trim()]),
  )
}
