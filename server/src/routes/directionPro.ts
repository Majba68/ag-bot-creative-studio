import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { config, hasVision } from '../config.js'
import { askLlm } from '../services/llm.js'
import { demoCandles } from '../services/twelveData.js'
import {
  buildDirectionProPrompt,
  DIRECTION_PRO_SYSTEM_PROMPT,
  parseDirectionProResponse,
} from '../services/directionPro.js'
import type {
  DirectionProAnalyzeResponse,
  DirectionProVerifyDemoResponse,
  Interval,
} from '../types.js'

export const directionProRouter = Router()

const allowedIntervals: Interval[] = ['1min', '5min', '15min', '30min', '1h']
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

directionProRouter.post('/analyze', singleImage, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ available: false, result: null, error: 'Please upload a Quotex chart screenshot.' })
    return
  }

  if (!hasValidImageSignature(req.file.buffer, req.file.mimetype)) {
    const body: DirectionProAnalyzeResponse = {
      available: false,
      result: null,
      error: 'The uploaded file is not a valid PNG or JPEG image.',
    }
    res.status(400).json(body)
    return
  }

  if (!hasVision()) {
    const body: DirectionProAnalyzeResponse = {
      available: false,
      result: null,
      error: 'Vision AI Not Configured. Set LLM_PROVIDER, LLM_API_KEY and VISION_MODEL in server/.env.',
    }
    res.json(body)
    return
  }

  const imageDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
  const completion = await askLlm({
    system: DIRECTION_PRO_SYSTEM_PROMPT,
    prompt: buildDirectionProPrompt(),
    model: config.visionModel,
    imageDataUrl,
    maxTokens: 4096,
  })

  if (!completion.configured || completion.error || !completion.text.trim()) {
    // Log diagnostics only; never log the key or the uploaded image bytes.
    console.error('[AG BOT Smart Direction Pro] Provider analysis failed:', completion.error ?? 'empty model response')
    const body: DirectionProAnalyzeResponse = {
      available: false,
      result: null,
      error: completion.error
        ? `Smart Direction Pro analysis is unavailable (${completion.error}). No interpretation was produced.`
        : 'The vision model returned no response. No interpretation was produced.',
    }
    res.json(body)
    return
  }

  try {
    const result = parseDirectionProResponse(completion.text, config.visionModel)
    const body: DirectionProAnalyzeResponse = { available: true, result }
    res.json(body)
  } catch (error) {
    console.error('[AG BOT Smart Direction Pro] Unusable model response:', error instanceof Error ? error.message : 'unknown error')
    const body: DirectionProAnalyzeResponse = {
      available: false,
      result: null,
      error: `The vision model returned an unusable response (${error instanceof Error ? error.message : 'unknown error'}). No interpretation was produced.`,
    }
    res.json(body)
  }
})

directionProRouter.post('/verify-demo', (req, res) => {
  const body = req.body as { symbol?: unknown; interval?: unknown; horizon?: unknown }
  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : ''
  const interval = body.interval as Interval
  const horizon = Number(body.horizon ?? 5)

  if (!/^[A-Z0-9/._-]{3,20}$/.test(symbol)) {
    const response: DirectionProVerifyDemoResponse = {
      available: false,
      data: null,
      error: 'A valid demo symbol is required for simulated verification.',
    }
    res.status(400).json(response)
    return
  }

  if (!allowedIntervals.includes(interval)) {
    const response: DirectionProVerifyDemoResponse = {
      available: false,
      data: null,
      error: 'A valid interval is required for simulated verification.',
    }
    res.status(400).json(response)
    return
  }

  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 20) {
    const response: DirectionProVerifyDemoResponse = {
      available: false,
      data: null,
      error: 'Verification horizon must be an integer from 1 to 20 demo bars.',
    }
    res.status(400).json(response)
    return
  }

  if (!config.demoMode) {
    const response: DirectionProVerifyDemoResponse = {
      available: false,
      data: null,
      error: 'Demo verification is unavailable. Enable DEMO_MODE=true; real market accuracy is not calculated here.',
    }
    res.json(response)
    return
  }

  const { candles } = demoCandles(symbol, interval)
  const last = candles[candles.length - 1]
  const earlier = candles[candles.length - 1 - horizon]
  const outcome = last.close >= earlier.close ? 'UP' : 'DOWN'

  const response: DirectionProVerifyDemoResponse = {
    available: true,
    data: {
      simulated: true,
      symbol,
      interval,
      horizon,
      outcome,
      basis: 'Simulated outcome is the sign of close[last] minus close[last - horizon] from the local demo generator. No real market data is used.',
      lastCandleTime: new Date(last.time * 1000).toISOString(),
      generatedAt: new Date().toISOString(),
    },
  }
  res.json(response)
})
