import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import express from 'express'

const mockModelResponse = {
  verdict: 'WAIT',
  confidence: 58,
  summary: 'The visible candles show mixed structure with a rejection wick near resistance.',
  upScenario: 'A close above the visible resistance would support the UP scenario.',
  downScenario: 'A second rejection from the same zone would support the DOWN scenario.',
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

type CapturedRequest = {
  url: string
  headers: Record<string, string>
  body: {
    model: string
    system_instruction: string
    store: boolean
    generation_config: { max_output_tokens: number }
    input: Array<Record<string, unknown>>
  }
}

test('Gemini vision path sends the signed request and parses the Interactions response', async () => {
  const original = {
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_MODEL: process.env.LLM_MODEL,
    VISION_MODEL: process.env.VISION_MODEL,
  }
  // Set before importing config: configuration is read once at module load.
  process.env.LLM_PROVIDER = 'gemini'
  process.env.LLM_API_KEY = 'test-gemini-key-never-used'
  process.env.LLM_MODEL = 'gemini-3.5-flash-lite'
  process.env.VISION_MODEL = 'gemini-3.5-flash-lite'

  const nativeFetch = globalThis.fetch
  const captured: { request: CapturedRequest | null } = { request: null }
  const { visionRouter } = await import('../../routes/vision.js')

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('generativelanguage.googleapis.com')) {
      captured.request = {
        url,
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: JSON.parse(String(init?.body ?? '{}')) as CapturedRequest['body'],
      }
      return new Response(JSON.stringify({
        id: 'test-interaction',
        object: 'interaction',
        status: 'completed',
        steps: [{
          type: 'model_output',
          content: [{ type: 'text', text: JSON.stringify(mockModelResponse) }],
        }],
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
    assert.equal(body.result.confidence, 58)
    assert.equal(body.result.model, 'gemini-3.5-flash-lite')
    assert.match(body.result.disclaimer, /not financial advice/i)

    assert.ok(captured.request, 'Gemini endpoint was not called')
    const request = captured.request as CapturedRequest
    assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/interactions')
    assert.equal(request.headers['x-goog-api-key'], 'test-gemini-key-never-used')
    assert.equal(request.headers['Api-Revision'], '2026-05-20')
    assert.equal(request.body.model, 'gemini-3.5-flash-lite')
    assert.equal(request.body.store, false)
    assert.ok(request.body.generation_config.max_output_tokens >= 1800)
    assert.match(request.body.system_instruction, /AG BOT Vision/)
    assert.equal(request.body.input[0]?.type, 'text')
    assert.equal(request.body.input[1]?.type, 'image')
    assert.equal(request.body.input[1]?.mime_type, 'image/png')
    assert.equal(typeof request.body.input[1]?.data, 'string')
  } finally {
    globalThis.fetch = nativeFetch
    server.close()
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
