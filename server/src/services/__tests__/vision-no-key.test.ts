import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import express from 'express'

test('missing API key returns a clear not-configured error and calls no vision provider', async () => {
  const original = {
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    LLM_API_KEY: process.env.LLM_API_KEY,
    VISION_MODEL: process.env.VISION_MODEL,
  }
  process.env.LLM_PROVIDER = 'gemini'
  process.env.LLM_API_KEY = ''
  process.env.VISION_MODEL = 'gemini-3.5-flash-lite'

  const nativeFetch = globalThis.fetch
  let providerCalled = false
  const { visionRouter } = await import('../../routes/vision.js')

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (
      url.includes('generativelanguage.googleapis.com') ||
      url.includes('api.openai.com') ||
      url.includes('api.anthropic.com')
    ) {
      providerCalled = true
      throw new Error('A vision provider must not be called without an API key')
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
      result: unknown
      error?: string
    }

    assert.equal(response.status, 200)
    assert.equal(body.available, false)
    assert.equal(body.result, null)
    assert.match(body.error ?? '', /Vision AI Not Configured/i)
    assert.match(body.error ?? '', /LLM_API_KEY/)
    assert.equal(providerCalled, false)
  } finally {
    globalThis.fetch = nativeFetch
    server.close()
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
