import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { config, hasVision } from '../config.js'
import { askLlm } from '../services/llm.js'
import { buildVisionPrompt, parseVisionResponse, VISION_SYSTEM_PROMPT } from '../services/vision.js'
import type { VisionSettings } from '../types.js'

export const visionRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpeg') {
      callback(new Error('Only PNG, JPG or JPEG screenshots are supported.'))
      return
    }
    callback(null, true)
  },
})

function singleImage(req: Request, res: Response, next: NextFunction) {
  upload.single('image')(req, res, (error) => {
    if (error) {
      const detail = error instanceof Error ? error.message : 'Invalid image upload.'
      res.status(400).json({ available: false, result: null, error: detail })
      return
    }
    next()
  })
}

function hasValidImageSignature(buffer: Buffer, mimetype: string): boolean {
  if (mimetype === 'image/png') {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
}

function normalizeSettings(value: unknown): VisionSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  const timeframe = body.timeframe
  const duration = Number(body.duration)
  const marketType = body.marketType
  const depth = body.depth

  const validTimeframe = ['1min', '5min', '15min', '30min', '1h'].includes(String(timeframe))
  const validDuration = Number.isInteger(duration) && duration >= 1 && duration <= 60

  if (
    typeof body.pair !== 'string' || !body.pair.trim() || body.pair.length > 40 ||
    !validTimeframe || !validDuration ||
    (marketType !== 'forex' && marketType !== 'otc') ||
    (depth !== 'quick' && depth !== 'standard' && depth !== 'deep')
  ) {
    return null
  }

  return {
    pair: body.pair.trim(),
    timeframe: timeframe as VisionSettings['timeframe'],
    duration,
    marketType,
    depth,
  }
}

visionRouter.post('/analyze', singleImage, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ available: false, result: null, error: 'Please upload a chart screenshot.' })
    return
  }

  if (!hasValidImageSignature(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({
      available: false,
      result: null,
      error: 'The uploaded file is not a valid PNG or JPEG image.',
    })
    return
  }

  let rawSettings: unknown = req.body?.settings
  if (typeof rawSettings === 'string') {
    try {
      rawSettings = JSON.parse(rawSettings)
    } catch {
      rawSettings = null
    }
  }
  const settings = normalizeSettings(rawSettings)
  if (!settings) {
    res.status(400).json({
      available: false,
      result: null,
      error: 'The analysis context is invalid. Please reload the analyzer and try again.',
    })
    return
  }

  if (!hasVision()) {
    res.json({
      available: false,
      result: null,
      error: 'Vision AI Not Configured. Set LLM_PROVIDER, LLM_API_KEY and VISION_MODEL in server/.env.',
    })
    return
  }

  const imageDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
  const completion = await askLlm({
    system: VISION_SYSTEM_PROMPT,
    prompt: buildVisionPrompt(settings),
    model: config.visionModel,
    imageDataUrl,
    maxTokens: 1800,
  })

  if (!completion.configured || completion.error || !completion.text.trim()) {
    // Log diagnostics only; never log the key or the uploaded image bytes.
    console.error('[AG BOT Vision] Provider analysis failed:', completion.error ?? 'empty model response')
    res.json({
      available: false,
      result: null,
      error: completion.error
        ? `Vision analysis is unavailable (${completion.error}). No interpretation was produced.`
        : 'The vision model returned no response. No interpretation was produced.',
    })
    return
  }

  try {
    const result = parseVisionResponse(completion.text, config.visionModel)
    res.json({ available: true, result })
  } catch (error) {
    console.error('[AG BOT Vision] Unusable model response:', error instanceof Error ? error.message : 'unknown error')
    res.json({
      available: false,
      result: null,
      error: `The vision model returned an unusable response (${error instanceof Error ? error.message : 'unknown error'}). No interpretation was produced.`,
    })
  }
})
