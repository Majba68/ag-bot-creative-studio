import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { config, hasLlm, hasMarketData, hasVision, llmProvider } from './config.js'
import type { DataMode } from './types.js'
import { rateLimit } from './middleware.js'
import { analysisRouter } from './routes/analysis.js'
import { assistantRouter } from './routes/assistant.js'
import { creativeStudioRouter } from './routes/creativeStudio.js'
import { directionProRouter } from './routes/directionPro.js'
import { horrorTrackingRouter } from './routes/horrorTracking.js'
import { marketRouter } from './routes/market.js'
import { smartChartSetupRouter } from './routes/smartChartSetup.js'
import { supportResistanceRouter } from './routes/supportResistance.js'
import { visionRouter } from './routes/vision.js'

const app = express()
const dataMode: DataMode = config.demoMode ? 'simulated' : hasMarketData() ? 'real' : 'unavailable'

app.use(cors({ origin: config.clientOrigin, credentials: false }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    version: '1.0.0',
    serverTime: new Date().toISOString(),
    marketDataConfigured: hasMarketData(),
    llmConfigured: hasLlm(),
    visionConfigured: hasVision(),
    llmProvider: llmProvider(),
    demoMode: config.demoMode,
    dataMode,
  })
})

app.use('/api/market', rateLimit(60_000, 90), marketRouter)
app.use('/api/analysis', rateLimit(60_000, 30), analysisRouter)
app.use('/api/assistant', rateLimit(60_000, 40), assistantRouter)
app.use('/api/vision/direction-pro', rateLimit(60_000, 20), directionProRouter)
app.use('/api/vision/horror-tracking', rateLimit(60_000, 120), horrorTrackingRouter)
app.use('/api/vision/smart-chart-setup', rateLimit(60_000, 20), smartChartSetupRouter)
app.use('/api/vision/support-resistance', rateLimit(60_000, 20), supportResistanceRouter)
app.use('/api/vision', rateLimit(60_000, 20), visionRouter)
app.use('/api/creative-studio', rateLimit(60_000, 60), creativeStudioRouter)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Unknown API endpoint.' })
})

const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url))
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('[AG BOT API]', error)
  if (res.headersSent) return
  const multerError = error instanceof Error && error.name === 'MulterError'
  const status = multerError || (error instanceof Error && 'status' in error && error.status === 400) ? 400 : 500
  const message = multerError && error instanceof Error
    ? error.message
    : status === 400 ? 'The request was invalid.' : 'An unexpected server error occurred.'
  res.status(status).json({ error: message })
}
app.use(errorHandler)

export default app

// On Vercel the app is invoked as a serverless function, not a long-running
// process. Only listen locally when this file is the actual entry point.
const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly && process.env.VERCEL !== '1') {
  app.listen(config.port, () => {
    console.log(`AG BOT API listening on http://localhost:${config.port}`)
    console.log(`Data mode: ${dataMode.toUpperCase()}${config.demoMode ? ' — simulated educational data only' : ''}`)
    console.log(`Market data: ${hasMarketData() ? 'configured' : 'NOT configured (no prices will be shown)'}`)
    console.log(`AI service: ${hasLlm() ? `configured (${llmProvider()})` : 'NOT configured (deterministic analysis only)'}`)
    console.log(`Vision AI: ${hasVision() ? `configured (${config.visionModel})` : 'NOT configured (set VISION_MODEL to a vision-capable model)'}`)
  })
}
