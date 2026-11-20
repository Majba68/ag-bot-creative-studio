import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { config, hasLlm, hasVision } from '../config.js'
import { askLlm, notConfiguredMessage, safeText } from '../services/llm.js'

export const assistantRouter = Router()

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
      res.status(400).json({
        available: false,
        text: error instanceof Error ? error.message : 'Invalid image upload.',
        error: error instanceof Error ? error.message : 'Invalid image upload.',
      })
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

/** Never trust the shape of a client-supplied analysis object. */
function analysisFacts(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'No analysis has been run yet in this session.'
  const source = value as Record<string, unknown>
  const list = (key: string) => Array.isArray(source[key])
    ? (source[key] as unknown[]).filter((item) => typeof item === 'string' || typeof item === 'number').join(', ')
    : 'unavailable'
  const metrics = source.metrics && typeof source.metrics === 'object' && !Array.isArray(source.metrics)
    ? source.metrics as Record<string, unknown>
    : {}
  const scalar = (item: unknown) => (typeof item === 'string' || typeof item === 'number' ? String(item) : 'unavailable')
  return [
    `Signal: ${scalar(source.signal)}`,
    `Confidence: ${scalar(source.confidence)}%`,
    `Score: ${scalar(source.score)}`,
    `Explanation: ${scalar(source.explanation)}`,
    `Support: ${list('support')}`,
    `Resistance: ${list('resistance')}`,
    `RSI: ${scalar(metrics.rsi)}`,
    `MACD histogram: ${scalar(metrics.macdHistogram)}`,
    `Volume: ${metrics.volumeAvailable === true ? 'available' : 'unavailable'}`,
    `Data status: ${scalar(source.dataStatus)}`,
  ].join('\n')
}

function analysisFallback(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return notConfiguredMessage
  const source = value as Record<string, unknown>
  const signal = typeof source.signal === 'string' ? source.signal : 'unavailable'
  const confidence = typeof source.confidence === 'number' ? source.confidence : 'unavailable'
  const explanation = typeof source.explanation === 'string' ? source.explanation : ''
  return `The current analysis shows ${signal} with ${confidence}% confidence. ${explanation} ${notConfiguredMessage}`.trim()
}

assistantRouter.post('/chat', async (req, res) => {
  try {
    const message = String(req.body?.message ?? '').trim().slice(0, 2000)
    const analysis = req.body?.analysis as unknown

    if (!message) {
      res.status(400).json({ error: 'Please enter a question.' })
      return
    }

    const facts = analysisFacts(analysis)
    const fallback = analysisFallback(analysis)

    if (!hasLlm()) {
      res.json({ available: false, text: fallback })
      return
    }

    const result = await askLlm({
      system:
        'You are the AG BOT trading assistant. Answer briefly and neutrally using only the grounding facts provided. ' +
        'You may explain technical indicators in general terms. Never promise profits, guarantee outcomes, claim certainty, or place trades. ' +
        'Remind the user that analysis is informational when relevant.',
      prompt: `Grounding facts:\n${facts}\n\nUser question: ${message}\n\nAnswer in at most 120 words.`,
    })

    if (!result.configured || result.error) {
      res.json({
        available: false,
        text: result.error ? `The AI service is unavailable (${result.error}). ${fallback}` : fallback,
        error: result.error,
      })
      return
    }

    res.json({ available: true, text: safeText(result.text, fallback) })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The assistant could not answer.'
    res.json({ available: false, text: `The assistant could not answer (${detail}).`, error: detail })
  }
})

assistantRouter.post('/vision', singleImage, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ available: false, text: 'Please upload an image.', error: 'Please upload an image.' })
    return
  }

  if (!hasValidImageSignature(req.file.buffer, req.file.mimetype)) {
    const detail = 'The uploaded file is not a valid PNG or JPEG image.'
    res.status(400).json({ available: false, text: detail, error: detail })
    return
  }

  const notReady = 'Screenshot analysis requires a configured vision model. Set LLM_PROVIDER, LLM_API_KEY and VISION_MODEL in server/.env. No interpretation is shown until then.'
  if (!hasVision()) {
    res.json({ available: false, text: notReady, error: notReady })
    return
  }

  const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
  try {
    const result = await askLlm({
      system:
        'You analyse trading-chart screenshots conservatively. Describe only what is visibly present: pair or timeframe labels if legible, candlestick direction, support/resistance zones that are drawn, and named indicators. ' +
        'Do not invent values, do not predict future prices, and never claim certainty or guaranteed outcomes. If the image is not a chart, say so.',
      prompt:
        'List up to four observable features of this chart screenshot, then one short caution sentence. Use plain text only.',
      imageDataUrl: dataUrl,
      model: config.visionModel,
    })

    if (!result.configured || result.error) {
      res.json({
        available: false,
        text: result.error ? `Vision analysis is unavailable (${result.error}). ${notReady}` : notReady,
        error: result.error,
      })
      return
    }

    res.json({ available: true, text: safeText(result.text, notReady) })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Vision analysis failed.'
    res.json({ available: false, text: `Vision analysis is unavailable (${detail}).`, error: detail })
  }
})
