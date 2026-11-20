import { Router } from 'express'
import { OTC_PAIRS } from '../catalog.js'
import { analyze } from '../services/analysis.js'
import { getCandles, isInterval } from '../services/twelveData.js'
import type { Interval, MarketPayload } from '../types.js'

export const analysisRouter = Router()

analysisRouter.post('/analyze', async (req, res) => {
  const symbol = String(req.body?.symbol ?? '').trim().toUpperCase()
  const interval = String(req.body?.interval ?? '1min')
  const requestedHigher = Array.isArray(req.body?.higherIntervals) ? req.body.higherIntervals : []

  if (!symbol || !isInterval(interval)) {
    res.status(400).json({ error: 'A valid currency pair and timeframe are required.' })
    return
  }

  const isSynthetic = OTC_PAIRS.some((pair) => pair.symbol === symbol) || /OTC|INDEX/i.test(symbol)
  if (isSynthetic) {
    res.status(400).json({
      error: 'Broker-synthetic OTC instruments have no independent live feed, so no price or analysis is available. Open your broker’s own chart to review them.',
    })
    return
  }

  const higherIntervals: Interval[] = requestedHigher
    .filter((value: unknown): value is Interval => typeof value === 'string' && isInterval(value) && value !== interval)
    .slice(0, 2)

  try {
    const payloads: MarketPayload[] = await Promise.all([
      getCandles(symbol, interval),
      ...higherIntervals.map((value) => getCandles(symbol, value)),
    ])
    const result = await analyze(payloads[0], payloads.slice(1))
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: 'Analysis could not be completed.', detail: String(error) })
  }
})
