import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { config, hasVision } from '../config.js'
import { askLlm } from '../services/llm.js'
import {
  buildHorrorTrackingPrompt,
  HORROR_TRACKING_SYSTEM_PROMPT,
  parseHorrorTrackingResponse,
} from '../services/horrorTracking.js'
import type { HorrorTrackingFrameResponse } from '../types.js'

export const horrorTrackingRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpeg') {
      callback(new Error('Only PNG or JPEG video frames are supported.'))
      return
    }
    callback(null, true)
  },
})

function singleFrame(req: Request, res: Response, next: NextFunction) {
  upload.single('frame')(req, res, (error) => {
    if (error) {
      res.status(400).json({
        available: false,
        result: null,
        error: error instanceof Error ? error.message : 'Invalid frame upload.',
      } satisfies HorrorTrackingFrameResponse)
      return
    }
    next()
  })
}

function validImage(buffer: Buffer, mimetype: string): boolean {
  if (mimetype === 'image/png') {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
}

function normalizeFrameIndex(value: unknown, fallback: number): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(9999, Math.max(0, Math.round(number)))
}

function normalizeTime(value: unknown, fallback: number): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(86400, Math.max(0, Math.round(number * 100) / 100))
}

horrorTrackingRouter.post('/frame', singleFrame, async (req, res) => {
  const fallbackIndex = normalizeFrameIndex(req.body?.frameIndex, 0)
  const fallbackTime = normalizeTime(req.body?.timeSec, 0)

  if (!req.file) {
    res.status(400).json({
      available: false,
      result: null,
      error: 'Please upload a video frame.',
    } satisfies HorrorTrackingFrameResponse)
    return
  }

  if (!validImage(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({
      available: false,
      result: null,
      error: 'The uploaded frame is not a valid PNG or JPEG image.',
    } satisfies HorrorTrackingFrameResponse)
    return
  }

  if (!hasVision()) {
    res.json({
      available: false,
      result: null,
      error: 'Vision AI Not Configured. Set LLM_PROVIDER, LLM_API_KEY and VISION_MODEL in server/.env.',
    } satisfies HorrorTrackingFrameResponse)
    return
  }

  const imageDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
  const completion = await askLlm({
    system: HORROR_TRACKING_SYSTEM_PROMPT,
    prompt: buildHorrorTrackingPrompt(fallbackIndex, fallbackTime),
    model: config.visionModel,
    imageDataUrl,
    maxTokens: 1200,
  })

  if (!completion.configured || completion.error || !completion.text.trim()) {
    console.error('[AG BOT Horror Tracking] Provider frame analysis failed:', completion.error ?? 'empty model response')
    res.json({
      available: false,
      result: null,
      error: completion.error
        ? `Frame analysis is unavailable (${completion.error}). No tracking result was produced.`
        : 'The vision model returned no response. No tracking result was produced.',
    } satisfies HorrorTrackingFrameResponse)
    return
  }

  try {
    const result = parseHorrorTrackingResponse(completion.text, fallbackIndex, fallbackTime)
    res.json({ available: true, result } satisfies HorrorTrackingFrameResponse)
  } catch (error) {
    console.error('[AG BOT Horror Tracking] Unusable frame response:', error instanceof Error ? error.message : 'unknown error')
    res.json({
      available: false,
      result: null,
      error: `The vision model returned an unusable response (${error instanceof Error ? error.message : 'unknown error'}). No tracking result was produced.`,
    } satisfies HorrorTrackingFrameResponse)
  }
})
