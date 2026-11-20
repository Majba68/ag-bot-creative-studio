import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Verifies the real Twelve Data request path with a mocked HTTP response.
 * The key below is a placeholder, never a real credential.
 */
test('Twelve Data candles are requested server-side with the key and parsed safely', async () => {
  const originalDemoMode = process.env.DEMO_MODE
  process.env.DEMO_MODE = 'false'
  process.env.TWELVEDATA_API_KEY = 'test-key-not-real'
  const originalFetch = globalThis.fetch
  let capturedUrl = ''
  const recentMinute = Math.floor(Date.now() / 1000 / 60) * 60
  const stamp = (offsetMinutes: number) =>
    new Date((recentMinute + offsetMinutes * 60) * 1000).toISOString().slice(0, 16).replace('T', ' ')

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrl = String(input)
    return new Response(JSON.stringify({
      status: 'ok',
      values: [
        { datetime: stamp(-2), open: '1.1000', high: '1.1020', low: '1.0990', close: '1.1010', volume: '0' },
        { datetime: stamp(-1), open: '1.1010', high: '1.1030', low: '1.1005', close: '1.1020', volume: '0' },
        // Malformed row: high below low. Must be discarded.
        { datetime: stamp(0), open: '1.1020', high: '1.0000', low: '1.1050', close: '1.1020', volume: '0' },
        // Malformed row: empty cells must never become 0-price candles.
        { datetime: stamp(1), open: '', high: '', low: '', close: '', volume: '' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch

  try {
    const { getCandles } = await import('../twelveData.js')
    const payload = await getCandles('EUR/USD', '1min')

    assert.match(capturedUrl, /api\.twelvedata\.com\/time_series/)
    assert.match(capturedUrl, /symbol=EUR%2FUSD/)
    assert.match(capturedUrl, /interval=1min/)
    assert.match(capturedUrl, /apikey=test-key-not-real/)
    assert.equal(payload.status, 'live')
    assert.equal(payload.candles.length, 2)
    assert.equal(payload.volumeAvailable, false)
    assert.ok(payload.candles.every((candle) =>
      candle.high >= Math.max(candle.open, candle.close) &&
      candle.low <= Math.min(candle.open, candle.close),
    ))
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.TWELVEDATA_API_KEY
    if (originalDemoMode === undefined) delete process.env.DEMO_MODE
    else process.env.DEMO_MODE = originalDemoMode
  }
})
