import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import express from 'express'

const mockModelResponse = {
  verdict: 'WAIT',
  confidence: 62,
  summary: 'Recent candles show a mild upward structure, but the newest candle rejects the visible resistance zone.',
  upScenario: 'A decisive close above the drawn resistance would support the UP scenario.',
  downScenario: 'Another rejection from the same zone would support the DOWN scenario.',
  waitReason: 'Bullish structure and bearish rejection are both visible, so the evidence conflicts.',
  observedFacts: [
    'The chart shows several higher lows before the latest candle.',
    'The latest candle has a long upper wick near a drawn horizontal line.',
  ],
  interpretations: ['The upper wick may indicate rejection at that zone.'],
  detectedPatterns: ['Higher lows', 'Long upper wick'],
  bullishEvidence: ['Higher lows are visible.'],
  bearishEvidence: ['The latest upper wick rejects the drawn zone.'],
  supportResistance: ['A horizontal resistance line is visible near the latest high.'],
  trendStrength: 'Mild upward structure',
  conflictingIndicators: ['Bullish structure conflicts with bearish rejection.'],
  missingInformation: ['Exact RSI and MACD values are unreadable in this screenshot.'],
  alternativeScenarios: ['A consolidation below resistance may form first.'],
  requestAnotherScreenshot: false,
}

test('vision route completes upload-to-analysis with a mocked vision provider', async () => {
  process.env.LLM_PROVIDER = 'openai'
  process.env.LLM_API_KEY = 'test-key-never-used'
  process.env.VISION_MODEL = 'gpt-4o-test'

  const nativeFetch = globalThis.fetch
  const { visionRouter } = await import('../../routes/vision.js')

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('api.openai.com')) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(mockModelResponse) } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return nativeFetch(input, init)
  }) as typeof fetch

  const app = express()
  app.use('/api/vision', visionRouter)
  const server = app.listen(0)
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo

  try {
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64',
    )
    const form = new FormData()
    form.append('image', new File([bytes], 'test-chart.png', { type: 'image/png' }))
    form.append('settings', JSON.stringify({
      pair: 'EUR/USD', timeframe: '1min', duration: 5, marketType: 'forex', depth: 'standard',
    }))

    const response = await nativeFetch(`http://127.0.0.1:${port}/api/vision/analyze`, {
      method: 'POST',
      body: form,
    })
    const body = await response.json() as {
      available: boolean
      error?: string
      result: { verdict: string; confidence: number; model: string; disclaimer: string } | null
    }

    assert.equal(response.status, 200)
    assert.equal(body.available, true)
    assert.equal(body.error, undefined)
    assert.ok(body.result)
    assert.equal(body.result.verdict, 'WAIT')
    assert.equal(body.result.confidence, 62)
    assert.equal(body.result.model, 'gpt-4o-test')
    assert.match(body.result.disclaimer, /not financial advice/i)
  } finally {
    globalThis.fetch = nativeFetch
    server.close()
  }
})
