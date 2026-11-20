import { config, hasMarketData } from '../config.js'
import { FOREX_PAIRS } from '../catalog.js'
import type { Candle, DataStatus, Interval, MarketPayload, Pair } from '../types.js'

export const INTERVAL_MINUTES: Record<Interval, number> = {
  '1min': 1,
  '5min': 5,
  '15min': 15,
  '30min': 30,
  '1h': 60,
}

export function isInterval(value: string): value is Interval {
  return Object.prototype.hasOwnProperty.call(INTERVAL_MINUTES, value)
}

type TimeSeriesRow = {
  datetime: string
  open: string
  high: string
  low: string
  close: string
  volume?: string
}

type TimeSeriesResponse = {
  status?: string
  message?: string
  values?: TimeSeriesRow[]
}

function parseTwelveDate(value: string): number {
  const normalised = value.includes('T') ? value : value.replace(' ', 'T')
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalised) ? normalised : `${normalised}Z`
  return Math.floor(Date.parse(withZone) / 1000)
}

function numericCell(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

type ValidRow = { time: number; open: number; high: number; low: number; close: number; volume: number | undefined }

/** Parse and validate provider rows. Invalid OHLC rows are discarded, never displayed. */
export function parseTimeSeries(rows: TimeSeriesRow[]): Candle[] {
  const candles = rows
    .map((row) => {
      const time = parseTwelveDate(String(row.datetime ?? ''))
      const open = numericCell(row.open)
      const high = numericCell(row.high)
      const low = numericCell(row.low)
      const close = numericCell(row.close)
      const volume = numericCell(row.volume)
      return {
        time, open, high, low, close,
        volume: volume !== null && volume > 0 ? volume : undefined,
      }
    })
    .filter((candle): candle is ValidRow =>
      Number.isFinite(candle.time) &&
      candle.open !== null && candle.open > 0 &&
      candle.high !== null && candle.high > 0 &&
      candle.low !== null && candle.low > 0 &&
      candle.close !== null && candle.close > 0 &&
      candle.high >= Math.max(candle.open, candle.close) &&
      candle.low <= Math.min(candle.open, candle.close),
    )
    .sort((a, b) => a.time - b.time)

  return candles.filter((candle, index) => index === 0 || candle.time !== candles[index - 1].time)
}

function freshness(candles: Candle[], interval: Interval): DataStatus {
  const last = candles[candles.length - 1]
  if (!last) return 'delayed'
  const ageMs = Date.now() - last.time * 1000
  const toleranceMs = INTERVAL_MINUTES[interval] * 60 * 1000 * 2.2
  return ageMs <= toleranceMs ? 'live' : 'delayed'
}

/** Deterministic, locally generated candles. Only ever returned when DEMO_MODE=true. */
export function demoCandles(symbol: string, interval: Interval): { candles: Candle[]; direction: 'UP' | 'DOWN' } {
  const minutes = INTERVAL_MINUTES[interval]
  const count = 240
  const aligned = Math.floor(Date.now() / 1000 / (minutes * 60)) * (minutes * 60)
  let hash = 0
  for (const character of symbol) hash = (hash * 31 + character.charCodeAt(0)) % 997
  const direction: 'UP' | 'DOWN' = hash % 2 === 0 ? 'UP' : 'DOWN'
  const scale = symbol.includes('JPY') ? 100 : 1
  const base = scale * (0.9 + hash / 1000)
  const step = scale * 0.00002
  const candles: Candle[] = []
  let previous = base
  for (let i = 0; i < count; i += 1) {
    const trend = (direction === 'UP' ? 1 : -1) * (i - count / 2) * step
    const wave = scale * (Math.sin(i / 11) * 0.00035 + Math.sin(i / 37) * 0.0002)
    const close = base + trend + wave
    const open = previous
    const spread = scale * (0.0002 + Math.abs(Math.sin(i / 5)) * 0.00025)
    candles.push({
      time: aligned - (count - 1 - i) * minutes * 60,
      open,
      high: Math.max(open, close) + spread,
      low: Math.min(open, close) - spread,
      close,
    })
    previous = close
  }
  return { candles, direction }
}

async function requestCandles(symbol: string, interval: Interval): Promise<MarketPayload> {
  if (config.demoMode) {
    const { candles, direction } = demoCandles(symbol, interval)
    return {
      symbol,
      interval,
      candles,
      status: 'simulated',
      lastUpdated: new Date(candles[candles.length - 1].time * 1000).toISOString(),
      volumeAvailable: false,
      reason: `SIMULATED DEMO DATA — a locally generated ${direction} trend for educational testing. These are NOT real market prices.`,
      source: 'AG BOT demo generator (simulated)',
    }
  }

  if (!hasMarketData()) {
    return {
      symbol,
      interval,
      candles: [],
      status: 'unavailable',
      lastUpdated: null,
      volumeAvailable: false,
      reason: 'TWELVEDATA_API_KEY is not configured on the server. No prices are shown until a real data provider is connected.',
      source: 'Twelve Data',
    }
  }

  const url = new URL('https://api.twelvedata.com/time_series')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('interval', interval)
  url.searchParams.set('outputsize', '240')
  url.searchParams.set('order', 'ASC')
  url.searchParams.set('timezone', 'Etc/UTC')
  url.searchParams.set('apikey', config.twelveDataKey)

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!response.ok) {
      return {
        symbol, interval, candles: [], status: 'error', lastUpdated: null, volumeAvailable: false,
        reason: `Market data provider returned HTTP ${response.status}.`, source: 'Twelve Data',
      }
    }
    const body = (await response.json()) as TimeSeriesResponse
    if (body.status === 'error' || !Array.isArray(body.values)) {
      return {
        symbol, interval, candles: [], status: 'error', lastUpdated: null, volumeAvailable: false,
        reason: body.message || 'The provider did not return candle data for this symbol and interval.',
        source: 'Twelve Data',
      }
    }

    const candles = parseTimeSeries(body.values)

    return {
      symbol,
      interval,
      candles,
      status: candles.length ? freshness(candles, interval) : 'error',
      lastUpdated: candles.length ? new Date(candles[candles.length - 1].time * 1000).toISOString() : null,
      volumeAvailable: candles.some((candle) => candle.volume !== undefined),
      reason: candles.length ? undefined : 'The provider returned no valid OHLC candles for this symbol and interval.',
      source: 'Twelve Data',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error'
    return {
      symbol, interval, candles: [], status: 'error', lastUpdated: null, volumeAvailable: false,
      reason: `Could not reach the market-data provider: ${message}`, source: 'Twelve Data',
    }
  }
}

const candleCache = new Map<string, { expires: number; payload: MarketPayload }>()
const inflight = new Map<string, Promise<MarketPayload>>()

export async function getCandles(symbol: string, interval: Interval): Promise<MarketPayload> {
  const key = `${symbol}|${interval}`
  const cached = candleCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.payload
  const pending = inflight.get(key)
  if (pending) return pending

  const ttl = Math.max(15000, Math.min(60000, INTERVAL_MINUTES[interval] * 1000))
  const request = requestCandles(symbol, interval)
    .then((payload) => {
      // Cache good responses only; errors should be retryable immediately.
      if (payload.candles.length > 0) candleCache.set(key, { expires: Date.now() + ttl, payload })
      return payload
    })
    .finally(() => inflight.delete(key))

  inflight.set(key, request)
  return request
}

let pairsCache: { expires: number; pairs: Pair[]; source: string } | null = null

export async function getPairs(): Promise<{ pairs: Pair[]; source: string }> {
  if (pairsCache && pairsCache.expires > Date.now()) {
    return { pairs: pairsCache.pairs, source: pairsCache.source }
  }

  let extra: Pair[] = []
  let source = 'Curated real-pair catalogue'
  if (hasMarketData()) {
    try {
      const url = new URL('https://api.twelvedata.com/forex_symbols')
      url.searchParams.set('apikey', config.twelveDataKey)
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const body = (await response.json()) as unknown
      const providerFailed = (body as { status?: string })?.status === 'error'
      const rows = !providerFailed && Array.isArray(body)
        ? body
        : !providerFailed && Array.isArray((body as { data?: unknown[] })?.data)
          ? (body as { data: unknown[] }).data
          : []
      if (providerFailed) throw new Error('Provider rejected the symbol list request')
      const known = new Set(FOREX_PAIRS.map((pair) => pair.symbol))
      extra = rows
        .map((row): Pair | null => {
          const item = row as { symbol?: string; name?: string; currency_base?: string; currency_quote?: string }
          if (!item.symbol || known.has(item.symbol)) return null
          known.add(item.symbol)
          return {
            symbol: item.symbol,
            name: item.name || `${item.currency_base ?? ''} / ${item.currency_quote ?? ''}`.trim(),
            category: 'forex' as const,
            base: item.currency_base,
            quote: item.currency_quote,
            liveFeed: true,
          }
        })
        .filter((pair): pair is Pair => pair !== null)
        .slice(0, 150)
      source = 'Curated catalogue + Twelve Data symbol list'
    } catch {
      source = 'Curated real-pair catalogue (provider symbol list unavailable)'
    }
  }

  const pairs = [...FOREX_PAIRS, ...extra]
  pairsCache = { expires: Date.now() + 60 * 60 * 1000, pairs, source }
  return { pairs, source }
}
