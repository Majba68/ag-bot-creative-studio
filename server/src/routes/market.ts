import { Router } from 'express'
import { OTC_PAIRS } from '../catalog.js'
import { getCandles, getPairs, isInterval } from '../services/twelveData.js'

export const marketRouter = Router()

marketRouter.get('/pairs', async (_req, res) => {
  try {
    const { pairs, source } = await getPairs()
    res.json({ forex: pairs, otc: OTC_PAIRS, source })
  } catch (error) {
    res.status(500).json({ error: 'Could not load the currency catalogue.', detail: String(error) })
  }
})

marketRouter.get('/candles', async (req, res) => {
  const symbol = String(req.query.symbol ?? '').trim().toUpperCase()
  const interval = String(req.query.interval ?? '1min')

  if (!symbol) {
    res.status(400).json({ error: 'A currency pair is required.' })
    return
  }
  if (!isInterval(interval)) {
    res.status(400).json({ error: 'Unsupported timeframe.' })
    return
  }

  const isSynthetic = OTC_PAIRS.some((pair) => pair.symbol === symbol) || /OTC|INDEX/i.test(symbol)
  if (isSynthetic) {
    res.json({
      symbol,
      interval,
      candles: [],
      status: 'unavailable',
      lastUpdated: null,
      volumeAvailable: false,
      reason:
        'This is a broker-synthetic OTC instrument. No independent public live feed exists for it, so no price or analysis is displayed here. Open your broker’s own chart to review it.',
      source: 'None — synthetic instrument',
    })
    return
  }

  try {
    const payload = await getCandles(symbol, interval)
    res.json(payload)
  } catch (error) {
    res.status(500).json({ error: 'Unexpected market-data error.', detail: String(error) })
  }
})
