import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { config, hasRemoveBg } from '../config.js'
import {
  buildImagePrompt,
  CreativeImageApiError,
  CREATIVE_SIZES,
  CREATIVE_STYLES,
  creativeCatalog,
  creativeConfig,
  creativeImagePreflight,
  generateBrief,
  generateCreativeImage,
  generateTextAsset,
  nearestAspectRatio,
  SUPPORTED_IMAGE_SIZES,
  SUPPORTED_RATIOS,
} from '../services/creativeImage.js'
import { removeLogoBackground } from '../services/creativePng.js'
import {
  deleteAsset,
  deleteProfile,
  deleteProject,
  getAsset,
  listProfiles,
  listProjects,
  saveAsset,
  saveProfile,
  saveProject,
  toggleProjectFavorite,
} from '../services/creativeStore.js'
import type {
  BusinessProfileInput,
  CreativeProjectInput,
  CreativeResultResponse,
  CreativeTextKind,
} from '../types.js'

export const creativeStudioRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpeg') {
      callback(new Error('Only PNG and JPG images are supported.'))
      return
    }
    callback(null, true)
  },
})

type AsyncRoute = (req: Request, res: Response) => Promise<void> | void
const handle = (fn: AsyncRoute) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res)).catch(next)
}

function singleImage(field: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(field)(req, res, (error) => {
      if (error) {
        res.status(400).json({ available: false, result: null, error: error.message })
        return
      }
      next()
    })
  }
}

function validImage(buffer: Buffer | undefined, mimetype: string | undefined): boolean {
  if (!buffer || !mimetype) return false
  if (mimetype === 'image/png') {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
}

function cleanedText(value: unknown, max = 400): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function objectField(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function failure<T>(res: Response, error: unknown, fallback: string): Response {
  const message = error instanceof Error ? error.message : fallback
  const quotaState = error instanceof CreativeImageApiError ? error.quota : undefined
  return res.json({
    available: false,
    result: null,
    error: message.slice(0, 800),
    ...(quotaState ? { quotaState } : {}),
  } satisfies CreativeResultResponse<T>)
}

const profileFields: Array<keyof BusinessProfileInput> = [
  'businessName', 'contact1', 'contact2', 'whatsapp', 'website', 'email', 'address',
  'facebook', 'instagram', 'services', 'description', 'brandColors', 'slogan',
]

function normalizeProfile(value: unknown): BusinessProfileInput | null {
  const body = objectField(value)
  const profile = {} as BusinessProfileInput
  for (const field of profileFields) {
    const limit = field === 'description' || field === 'services' ? 2000 : 500
    profile[field] = cleanedText(body[field], limit)
  }
  profile.logoAssetId = cleanedText(body.logoAssetId, 64)
  profile.teamPhotoAssetId = cleanedText(body.teamPhotoAssetId, 64)
  if (!profile.businessName && !profile.contact1 && !profile.services) return null
  return profile
}

function normalizeProject(value: unknown): CreativeProjectInput | null {
  const body = objectField(value)
  const design = objectField(body.design)
  if (!cleanedText(body.name, 120) || !design || typeof design !== 'object') return null
  if (!cleanedText(design.headline, 200) && !cleanedText(design.category, 80)) return null
  return {
    name: cleanedText(body.name, 120),
    favorite: body.favorite === true,
    profileId: cleanedText(body.profileId, 80),
    design: design as CreativeProjectInput['design'],
  }
}

creativeStudioRouter.get('/config', (_req, res) => {
  res.json(creativeConfig())
})

creativeStudioRouter.get('/catalog', (_req, res) => {
  res.json(creativeCatalog())
})

creativeStudioRouter.get('/preflight', handle(async (req, res) => {
  const force = req.query.force === '1'
  const state = await creativeImagePreflight(force)
  res.json({
    available: state.available,
    result: state,
    ...(state.available ? {} : { error: state.detail, quotaState: state.quota }),
  } satisfies CreativeResultResponse<typeof state>)
}))

creativeStudioRouter.post('/brief', handle(async (req, res) => {
  try {
    const request = cleanedText(req.body?.request, 2000)
    if (request.length < 4) {
      res.status(400).json({ available: false, result: null, error: 'Describe the poster you want before generating.' })
      return
    }
    const profile = objectField(req.body?.profile)
    const facts = Object.fromEntries(
      Object.entries(profile)
        .filter(([key, value]) => typeof value === 'string' && value.trim() && key !== 'logoAssetId' && key !== 'teamPhotoAssetId')
        .map(([key, value]) => [key, cleanedText(value, 300)]),
    )
    const result = await generateBrief({
      request,
      tool: cleanedText(req.body?.tool, 60) || 'poster',
      categoryHint: cleanedText(req.body?.categoryHint, 80),
      profile: facts,
    })
    res.json({ available: true, result } satisfies CreativeResultResponse<typeof result>)
  } catch (error) {
    failure(res, error, 'The AI creative planner failed.')
  }
}))

creativeStudioRouter.post('/text', handle(async (req, res) => {
  try {
    const kind = cleanedText(req.body?.kind, 30) as CreativeTextKind
    if (!['slogan', 'description', 'promo', 'colors'].includes(kind)) {
      res.status(400).json({ available: false, result: null, error: 'Unknown text tool.' })
      return
    }
    const request = cleanedText(req.body?.request, 1200)
    const category = cleanedText(req.body?.category, 80) || 'business'
    const profile = objectField(req.body?.profile)
    const facts = Object.fromEntries(
      Object.entries(profile)
        .filter(([key, value]) => typeof value === 'string' && value.trim() && !key.endsWith('AssetId'))
        .map(([key, value]) => [key, cleanedText(value, 300)]),
    )

    const prompts: Record<CreativeTextKind, { system: string; prompt: string }> = {
      slogan: {
        system: 'You are a premium advertising copywriter. Return only 5 short original slogans, one per line. Never invent contact details, prices, guarantees or credentials.',
        prompt: `Write five memorable slogans for a ${category} business. Request: ${request || 'professional promotional campaign'}. Business facts: ${JSON.stringify(facts)}`,
      },
      description: {
        system: 'You are a premium brand copywriter. Return only one polished business description of 40 to 80 words. Use only supplied facts. Never invent contact details, prices, guarantees or credentials.',
        prompt: `Write a professional description for a ${category} business. Request: ${request || 'warm and trustworthy brand positioning'}. Business facts: ${JSON.stringify(facts)}`,
      },
      promo: {
        system: 'You are a premium advertising copywriter. Return only three promotional text blocks, each with a headline and one sentence, separated by blank lines. Never invent contact details, prices, guarantees or credentials.',
        prompt: `Write promotional campaign copy for a ${category} business. Request: ${request || 'launch campaign'}. Business facts: ${JSON.stringify(facts)}`,
      },
      colors: {
        system: 'You are a brand colour strategist. Return only raw JSON with primary, secondary, accent, text and muted keys, each a lowercase hex colour. No markdown.',
        prompt: `Suggest a premium colour palette for a ${category} advertising poster. Request: ${request || 'bold modern professional'}. Business facts: ${JSON.stringify(facts)}`,
      },
    }
    const choice = prompts[kind]
    const result = await generateTextAsset(choice)
    res.json({ available: true, result } satisfies CreativeResultResponse<string>)
  } catch (error) {
    failure(res, error, 'The AI text tool failed.')
  }
}))

creativeStudioRouter.post('/image', handle(async (req, res) => {
  try {
    const prompt = cleanedText(req.body?.prompt, 5000)
    if (prompt.length < 20) {
      res.status(400).json({ available: false, result: null, error: 'The image prompt is too short.' })
      return
    }
    const ratio = cleanedText(req.body?.ratio, 12) || '4:5'
    const size = cleanedText(req.body?.size, 8) || '1K'
    if (!(SUPPORTED_RATIOS as readonly string[]).includes(ratio) || !(SUPPORTED_IMAGE_SIZES as readonly string[]).includes(size)) {
      res.status(400).json({ available: false, result: null, error: 'Unsupported image ratio or resolution.' })
      return
    }

    const sourceId = cleanedText(req.body?.sourceAssetId, 64)
    const source = sourceId ? await getAsset(sourceId) : null
    if (sourceId && !source) {
      res.status(400).json({ available: false, result: null, error: 'The source artwork could not be found. Upload it again.' })
      return
    }

    const generated = await generateCreativeImage({
      prompt,
      ratio,
      size,
      source: source ? { data: source.buffer, mime: source.mime } : undefined,
    })
    const mime = generated.mime === 'image/png' ? 'image/png' : 'image/jpeg'
    const extension = mime === 'image/png' ? 'png' : 'jpg'
    const asset = await saveAsset(generated.data, mime, `ai-background.${extension}`)
    res.json({
      available: true,
      result: { asset, model: generated.model, ratio },
    } satisfies CreativeResultResponse<{ asset: unknown; model: string; ratio: string }>)
  } catch (error) {
    failure(res, error, 'AI image generation failed.')
  }
}))

creativeStudioRouter.post('/upload', singleImage('image'), handle(async (req, res) => {
  if (!req.file || !validImage(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({ available: false, result: null, error: 'Upload a valid PNG or JPG image.' })
    return
  }
  const asset = await saveAsset(req.file.buffer, req.file.mimetype, req.file.originalname || 'upload.png')
  res.json({ available: true, result: asset })
}))

creativeStudioRouter.post('/logo/remove', singleImage('logo'), handle(async (req, res) => {
  if (!req.file || req.file.mimetype !== 'image/png' || !validImage(req.file.buffer, 'image/png')) {
    res.status(400).json({
      available: false,
      result: null,
      error: 'Convert the logo to PNG first. The background remover preserves the original logo pixels and cannot read JPG directly.',
    })
    return
  }

  let buffer = req.file.buffer
  let mode: 'api' | 'precision-local' = 'precision-local'
  let removedPixels: number | null = null
  let warning: string | undefined

  if (hasRemoveBg()) {
    try {
      const form = new FormData()
      form.append('image_file', new Blob([Uint8Array.from(buffer)], { type: 'image/png' }), req.file.originalname || 'logo.png')
      form.append('size', 'auto')
      form.append('format', 'png')
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-API-Key': config.removeBgKey },
        body: form,
        signal: AbortSignal.timeout(120_000),
      })
      if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, ' ').trim().slice(0, 200)
        throw new Error(detail || `HTTP ${response.status}`)
      }
      const apiBuffer = Buffer.from(await response.arrayBuffer())
      if (!validImage(apiBuffer, 'image/png')) throw new Error('The background removal API returned an invalid PNG.')
      buffer = apiBuffer
      mode = 'api'
    } catch (error) {
      warning = `The background removal API was unavailable, so local precision removal was used: ${error instanceof Error ? error.message : 'unknown error'}`
    }
  }

  if (mode === 'precision-local') {
    try {
      const local = removeLogoBackground(buffer)
      buffer = local.buffer
      removedPixels = local.removedPixels
      if (local.removedPixels === 0) {
        res.json({
          available: false,
          result: null,
          error: 'No uniform border background was detected. Use a logo with a solid or near-solid background, or configure REMOVEBG_API_KEY for true cutouts. No pixels were changed.',
        })
        return
      }
    } catch (error) {
      failure(res, error, 'Logo background removal failed.')
      return
    }
  }

  const asset = await saveAsset(buffer, 'image/png', 'logo-transparent.png')
  res.json({
    available: true,
    result: { asset, mode, removedPixels, warning },
  } satisfies CreativeResultResponse<{ asset: unknown; mode: string; removedPixels: number | null; warning?: string }>)
}))

creativeStudioRouter.get('/profiles', handle(async (_req, res) => {
  const profiles = await listProfiles()
  res.json({ available: true, result: profiles } satisfies CreativeResultResponse<typeof profiles>)
}))

creativeStudioRouter.post('/profiles', handle(async (req, res) => {
  try {
    const profile = normalizeProfile(req.body?.profile ?? req.body)
    if (!profile) {
      res.status(400).json({ available: false, result: null, error: 'Add a business name, a contact number or services before saving.' })
      return
    }
    for (const id of [profile.logoAssetId, profile.teamPhotoAssetId]) {
      if (id && !(await getAsset(id))) {
        res.status(400).json({ available: false, result: null, error: 'An uploaded image could not be found. Upload the logo or photo again.' })
        return
      }
    }
    const id = cleanedText(req.body?.id, 80) || undefined
    const saved = await saveProfile(profile, id)
    res.json({ available: true, result: saved })
  } catch (error) {
    failure(res, error, 'The business profile could not be saved.')
  }
}))

creativeStudioRouter.delete('/profiles/:id', handle(async (req, res) => {
  const removed = await deleteProfile(req.params.id)
  res.json({
    available: removed,
    result: removed ? { deleted: true } : null,
    error: removed ? undefined : 'Business profile not found.',
  })
}))

creativeStudioRouter.get('/projects', handle(async (_req, res) => {
  const projects = await listProjects()
  res.json({ available: true, result: projects } satisfies CreativeResultResponse<typeof projects>)
}))

creativeStudioRouter.post('/projects', singleImage('poster'), handle(async (req, res) => {
  if (!req.file || !validImage(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({ available: false, result: null, error: 'Render the poster before saving the project.' })
    return
  }
  let rawProject: unknown = req.body?.project
  if (typeof rawProject === 'string') {
    try {
      rawProject = JSON.parse(rawProject)
    } catch {
      rawProject = null
    }
  }
  const project = normalizeProject(rawProject)
  if (!project) {
    res.status(400).json({ available: false, result: null, error: 'The project data is invalid.' })
    return
  }
  const poster = await saveAsset(req.file.buffer, req.file.mimetype, `${project.name.replace(/[^\w-]+/g, '-').toLowerCase()}.${req.file.mimetype === 'image/png' ? 'png' : 'jpg'}`)
  const saved = await saveProject(project, poster.id, cleanedText(req.body?.id, 80) || undefined)
  res.json({ available: true, result: saved })
}))

creativeStudioRouter.post('/projects/:id/favorite', handle(async (req, res) => {
  const project = await toggleProjectFavorite(req.params.id)
  res.json({
    available: !!project,
    result: project,
    error: project ? undefined : 'Project not found.',
  })
}))

creativeStudioRouter.delete('/projects/:id', handle(async (req, res) => {
  const removed = await deleteProject(req.params.id)
  res.json({
    available: removed,
    result: removed ? { deleted: true } : null,
    error: removed ? undefined : 'Project not found.',
  })
}))

creativeStudioRouter.get('/assets/:id', handle(async (req, res) => {
  const asset = await getAsset(req.params.id)
  if (!asset) {
    res.status(404).json({ error: 'Image not found.' })
    return
  }
  const name = asset.name.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'image'
  res.setHeader('Content-Type', asset.mime)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  if (req.query.download === '1') res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
  res.send(asset.buffer)
}))

export function buildBackgroundPrompt(args: {
  category: string
  purpose: string
  style: string
  layout: string
  palette: { primary: string; secondary: string; accent: string }
  concept: number
}): string {
  const size = CREATIVE_SIZES.find((item) => item.id === 'instagram-portrait')
  return buildImagePrompt({
    ...args,
    style: CREATIVE_STYLES.includes(args.style as typeof CREATIVE_STYLES[number]) ? args.style : 'Ultra Luxury',
    extra: `Canvas ratio guidance: ${size?.ratio ?? '4:5'}.`,
  })
}
