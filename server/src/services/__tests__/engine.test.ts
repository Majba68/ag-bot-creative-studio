import assert from 'node:assert/strict'
import test, { before } from 'node:test'
import { analyze } from '../analysis.js'
import { config } from '../../config.js'
import { atr, detectPatterns, ema, macd, pivotLevels, rsi, sma } from '../indicators.js'
import { demoCandles } from '../twelveData.js'
import type { Candle, MarketPayload } from '../../types.js'

// Deterministic engine tests must never spend the real configured API key.
before(() => {
  config.llmKey = ''
})

/** Deterministic test fixtures — never used as market data by the application. */
function fixtureCandles(count: number, direction: 1 | -1): Candle[] {
  const candles: Candle[] = []
  let previousClose = 100
  for (let i = 0; i < count; i += 1) {
    const close = previousClose + direction * 0.4
    const open = previousClose
    const high = Math.max(open, close) + 0.25
    const low = Math.min(open, close) - 0.25
    candles.push({ time: 1_700_000_000 + i * 60, open, high, low, close })
    previousClose = close
  }
  return candles
}

function payload(candles: Candle[]): MarketPayload {
  return {
    symbol: 'TEST/PAIR',
    interval: '1min',
    candles,
    status: 'live',
    lastUpdated: new Date().toISOString(),
    volumeAvailable: false,
    source: 'test fixture',
  }
}

test('sma computes only complete windows', () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4])
})

test('ema seeds from the first complete window', () => {
  const values = ema([1, 2, 3, 4, 5], 3)
  assert.equal(values[2], 2)
  assert.ok((values[4] ?? 0) > (values[2] ?? 0))
})

test('rsi is 100 for an uninterrupted rise', () => {
  const values = rsi([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115], 14)
  assert.equal(values[15], 100)
})

test('macd histogram starts only after the slow EMA is available', () => {
  const result = macd(fixtureCandles(60, 1).map((candle) => candle.close))
  assert.equal(result.line[24], null)
  assert.ok(result.line[30] !== null)
  assert.ok(result.histogram[40] !== null)
})

test('atr is positive on valid candles', () => {
  const values = atr(fixtureCandles(40, 1), 14)
  assert.ok((values[20] ?? 0) > 0)
})

test('pivot levels bracket the last price', () => {
  const candles = fixtureCandles(80, 1)
  const levels = pivotLevels(candles)
  const price = candles[candles.length - 1].close
  assert.ok(levels.support.every((level) => level < price))
  assert.ok(levels.resistance.every((level) => level > price))
})

test('hammer pattern is detected from a lower-wick rejection', () => {
  const candles = fixtureCandles(5, 1)
  candles[4] = { time: candles[4].time, open: 100, close: 100.5, high: 100.7, low: 97 }
  const patterns = detectPatterns(candles)
  assert.ok(patterns.some((pattern) => pattern.name === 'Hammer'))
})

test('analysis returns WAIT with a reason when there is no real data', async () => {
  const unavailable = payload([])
  unavailable.status = 'unavailable'
  unavailable.reason = 'TWELVEDATA_API_KEY is not configured on the server.'
  const result = await analyze(unavailable)
  assert.equal(result.signal, 'WAIT')
  assert.equal(result.confidence, 0)
  assert.match(result.explanation, /unavailable|twelvedata/i)
  assert.match(result.disclaimer, /not financial advice/i)
})

test('analysis leans UP on a sustained rising fixture', async () => {
  const result = await analyze(payload(fixtureCandles(120, 1)))
  assert.equal(result.signal, 'UP')
  assert.ok(result.confidence > 40)
  assert.ok(result.score > 0.2)
})

test('analysis leans DOWN on a sustained falling fixture', async () => {
  const result = await analyze(payload(fixtureCandles(120, -1)))
  assert.equal(result.signal, 'DOWN')
  assert.ok(result.score < -0.2)
})

test('higher timeframe confirmation is reported when supplied', async () => {
  const result = await analyze(payload(fixtureCandles(120, 1)), [payload(fixtureCandles(80, 1))])
  assert.equal(result.timeframeConfirmation.length, 1)
  assert.equal(result.timeframeConfirmation[0].direction, 'UP')
})

test('real-data fixtures are never marked as educational demo analysis', async () => {
  const result = await analyze(payload(fixtureCandles(120, 1)))
  assert.equal(result.educationalDemo, false)
  assert.equal(result.dataStatus, 'live')
})

test('demo mode always produces a labelled simulated UP or DOWN example', async () => {
  for (const symbol of ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD']) {
    const generated = demoCandles(symbol, '1min')
    const demoPayload = payload(generated.candles)
    demoPayload.status = 'simulated'
    demoPayload.source = 'AG BOT demo generator (simulated)'
    const result = await analyze(demoPayload)
    assert.ok(result.signal === 'UP' || result.signal === 'DOWN', `${symbol} returned ${result.signal}`)
    assert.equal(result.educationalDemo, true)
    assert.equal(result.dataStatus, 'simulated')
    assert.match(result.explanation, /EDUCATIONAL DEMO ANALYSIS/i)
    assert.match(result.riskWarning, /SIMULATED DEMO DATA/i)
  }
})
