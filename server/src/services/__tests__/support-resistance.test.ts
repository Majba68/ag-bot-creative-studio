import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import express from 'express'
import {
  parseSupportResistanceResponse,
} from '../supportResistance.js'

const mockModelResponse = {
  enoughEvidence: true,
  summary: 'Repeated turning areas are visible around 1.1000 on this screenshot.',
  supportWhy: 'Buyers repeatedly defended the lower area near 1.0950.',
  resistanceWhy: 'Sellers rejected the upper area near 1.1050.',
  breakoutMeaning: 'A move above resistance would be a possible breakout scenario, not a prediction.',
  breakdownMeaning: 'A move below support would be a possible breakdown scenario, not a prediction.',
  observedFacts: [
    'The same lower area was tested several times.',
    'The upper area rejected two visible advances.',
  ],
  missingInformation: ['The exact axis values are unreadable.'],
  requestAnotherScreenshot: false,
  confidence: 68,
  zones: [
    {
      type: 'support',
      yPercent: 76.4,
      reason: 'Repeated reactions at the lower area near 1.0950.',
      strength: 'moderate',
    },
    {
      type: 'resistance',
      yPercent: 28.2,
      reason: 'Two rejections at the upper area near 1.1050.',
      strength: 'strong',
    },
  ],
}

test('support/resistance parser keeps normalized positions and strips price-like values', () => {
  const result = parseSupportResistanceResponse(JSON.stringify(mockModelResponse), 'test-vision-model')

  assert.equal(result.enoughEvidence, true)
  assert.equal(result.zones.length, 2)
  assert.deepEqual(
    result.zones.map((zone) => [zone.type, zone.yPercent]),
    [['support', 76.4], ['resistance', 28.2]],
  )
  assert.doesNotMatch(result.summary, /\d+\.\d{2,}/)
  assert.doesNotMatch(result.zones[0].reason, /\d+\.\d{2,}/)
  assert.match(result.disclaimer, /educational interpretation/i)
})

test('unclear screenshots produce no drawable zones', () => {
  const result = parseSupportResistanceResponse(JSON.stringify({
    ...mockModelResponse,
    enoughEvidence: false,
    requestAnotherScreenshot: true,
  }), 'test-vision-model')

  assert.equal(result.enoughEvidence, false)
  assert.equal(result.requestAnotherScreenshot, true)
  assert.equal(result.zones.length, 0)
  assert.ok(result.confidence <= 15)
})

test('support/resistance route completes upload-to-analysis with a mocked vision provider', async () => {
  process.env.LLM_PROVIDER = 'openai'
  process.env.LLM_API_KEY = 'test-key-never-used'
  process.env.VISION_MODEL = 'gpt-4o-test'

  const nativeFetch = globalThis.fetch
  const { supportResistanceRouter } = await import('../../routes/supportResistance.js')

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
  app.use('/api/vision/support-resistance', supportResistanceRouter)
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

    const response = await nativeFetch(`http://127.0.0.1:${port}/api/vision/support-resistance`, {
      method: 'POST',
      body: form,
    })
    const body = await response.json() as {
      available: boolean
      error?: string
      result: {
        enoughEvidence: boolean
        confidence: number
        model: string
        zones: Array<{ type: string; yPercent: number }>
      } | null
    }

    assert.equal(response.status, 200)
    assert.equal(body.available, true)
    assert.equal(body.error, undefined)
    assert.ok(body.result)
    assert.equal(body.result.enoughEvidence, true)
    assert.equal(body.result.model, 'gpt-4o-test')
    assert.equal(body.result.zones.length, 2)
    assert.ok(body.result.zones.every((zone) => zone.yPercent >= 2 && zone.yPercent <= 98))
  } finally {
    globalThis.fetch = nativeFetch
    server.close()
  }
})
