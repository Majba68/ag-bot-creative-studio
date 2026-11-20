import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import express from 'express'
import { parseSmartChartSetupResponse } from '../smartChartSetup.js'

const mockModelResponse = {
  enoughEvidence: true,
  summary: 'The screenshot shows a candlestick chart with a visible timeframe label near 1.0950 on the axis.',
  screenshot: {
    chartVisible: true,
    candlesVisible: true,
    timeframeVisible: '1min',
    visibleIndicators: ['EMA 20', 'EMA 50'],
    chartStructure: 'Candles form a mild rising sequence with two visible pullbacks.',
    observedFacts: ['A candlestick chart is visible.', 'Two moving-average lines are plotted.'],
    missingInformation: ['Exact indicator settings are not legible.'],
  },
  recommendations: [
    {
      name: 'RSI',
      category: 'indicator',
      whyUseful: 'It helps compare momentum with the visible candle structure.',
      suggestedSettings: '14-period with 70/30 levels',
      optional: false,
      clutterRisk: 'low',
    },
    {
      name: 'Trend Line',
      category: 'drawing',
      whyUseful: 'It connects visible reaction areas without adding an extra oscillator.',
      suggestedSettings: 'Draw across at least two clear swing points.',
      optional: true,
      clutterRisk: 'medium',
      clutterNote: 'Too many lines can make the chart harder to read.',
    },
  ],
  setupGuide: {
    indicatorsToConsider: ['RSI', 'Moving Average'],
    drawingToolsToConsider: ['Horizontal Line', 'Trend Line'],
    settingsAndConfigurations: ['Start with a 14-period RSI.', 'Keep two moving averages at most.'],
    howToCombine: ['Compare momentum with the visible trend structure.'],
    howToReadCombinedChart: ['Give more weight to agreement between tools than to one signal.'],
  },
  direction: {
    enoughInformation: true,
    verdict: 'WAIT',
    confidence: 62,
    upEvidence: ['Higher lows are visible.'],
    downEvidence: ['The latest candle shows an upper wick.'],
    conflictingSignals: ['Momentum and structure do not fully agree.'],
    waitReason: 'The evidence is mixed, so waiting is more appropriate.',
    requestAnotherScreenshot: false,
  },
  bengaliLearning: {
    toolsToUse: ['RSI এবং Moving Average দিয়ে শুরু করুন।'],
    whyToolsHelp: ['এই টুলগুলো দামের গতি ও প্রবণতা বুঝতে সাহায্য করে।'],
    howToConfigure: ['প্রথমে সাধারণ সেটিংস রাখুন এবং চার্টে মিলিয়ে দেখুন।'],
    howToReadChart: ['একক ইঙ্গিত নয়, একাধিক ইঙ্গিতের মিল দেখে চার্ট পড়ুন।'],
    upScenario: 'উপরের ইঙ্গিত মানে শুধু একটা সম্ভাব্য পরিস্থিতি।',
    downScenario: 'নিচের ইঙ্গিতও শুধু একটা সম্ভাব্য পরিস্থিতি।',
    waitGuidance: 'তথ্য মিশ্র হলে WAIT বেছে নেওয়া ঠিক।',
  },
}

test('smart chart setup parser keeps tool data, strips prices and separates language fields', () => {
  const result = parseSmartChartSetupResponse(JSON.stringify(mockModelResponse), 'test-vision-model')

  assert.equal(result.enoughEvidence, true)
  assert.equal(result.screenshot.timeframeVisible, '1min')
  assert.deepEqual(result.screenshot.visibleIndicators, ['EMA 20', 'EMA 50'])
  assert.equal(result.recommendations.length, 2)
  assert.equal(result.recommendations[0].name, 'RSI')
  assert.equal(result.recommendations[0].suggestedSettings, '14-period with 70/30 levels')
  assert.equal(result.recommendations[1].optional, true)
  assert.equal(result.recommendations[1].clutterRisk, 'medium')
  assert.equal(result.direction.verdict, 'WAIT')
  assert.doesNotMatch(result.summary, /1\.0950/)
  assert.match(result.bengaliLearning.upScenario, /[\u0980-\u09FF]/)
  assert.match(result.disclaimer, /educational chart-setup review/i)
})

test('single-item narrative arrays are accepted as Bengali strings', () => {
  const result = parseSmartChartSetupResponse(JSON.stringify({
    ...mockModelResponse,
    bengaliLearning: {
      ...mockModelResponse.bengaliLearning,
      upScenario: ['উপরের ইঙ্গিত মানে শুধু একটা সম্ভাব্য পরিস্থিতি।'],
      downScenario: ['নিচের ইঙ্গিতও শুধু একটা সম্ভাব্য পরিস্থিতি।'],
      waitGuidance: ['তথ্য মিশ্র হলে WAIT বেছে নেওয়া ঠিক।'],
    },
  }), 'test-vision-model')

  assert.equal(typeof result.bengaliLearning.upScenario, 'string')
  assert.match(result.bengaliLearning.upScenario, /[\u0980-\u09FF]/)
})

test('English report fields containing Bengali script are rejected', () => {
  assert.throws(
    () => parseSmartChartSetupResponse(JSON.stringify({
      ...mockModelResponse,
      summary: 'এই চার্টে কয়েকটি মোমবাতি আছে।',
    }), 'test-vision-model'),
    /English report fields contained Bengali script/,
  )
})

test('Bengali learning fields written in English are rejected', () => {
  assert.throws(
    () => parseSmartChartSetupResponse(JSON.stringify({
      ...mockModelResponse,
      bengaliLearning: { ...mockModelResponse.bengaliLearning, upScenario: 'Price may move up.' },
    }), 'test-vision-model'),
    /Bengali learning fields were incomplete/,
  )
})

test('unclear screenshots produce no recommendations but keep Bengali guidance', () => {
  const result = parseSmartChartSetupResponse(JSON.stringify({
    ...mockModelResponse,
    enoughEvidence: false,
  }), 'test-vision-model')

  assert.equal(result.enoughEvidence, false)
  assert.equal(result.recommendations.length, 0)
  assert.equal(result.direction.verdict, 'INSUFFICIENT_DATA')
  assert.equal(result.direction.requestAnotherScreenshot, true)
  assert.match(result.bengaliLearning.waitGuidance, /[\u0980-\u09FF]/)
})

test('smart chart setup route completes upload-to-analysis with a mocked vision provider', async () => {
  process.env.LLM_PROVIDER = 'openai'
  process.env.LLM_API_KEY = 'test-key-never-used'
  process.env.VISION_MODEL = 'gpt-4o-test'

  const nativeFetch = globalThis.fetch
  const { smartChartSetupRouter } = await import('../../routes/smartChartSetup.js')

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
  app.use('/api/vision/smart-chart-setup', smartChartSetupRouter)
  const server = app.listen(0)
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo

  try {
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64',
    )
    const form = new FormData()
    form.append('image', new File([bytes], 'dashboard.png', { type: 'image/png' }))

    const response = await nativeFetch(`http://127.0.0.1:${port}/api/vision/smart-chart-setup`, {
      method: 'POST',
      body: form,
    })
    const body = await response.json() as {
      available: boolean
      error?: string
      result: {
        model: string
        direction: { verdict: string }
        recommendations: Array<{ name: string }>
        bengaliLearning: { upScenario: string }
      } | null
    }

    assert.equal(response.status, 200)
    assert.equal(body.available, true)
    assert.equal(body.error, undefined)
    assert.ok(body.result)
    assert.equal(body.result.model, 'gpt-4o-test')
    assert.equal(body.result.direction.verdict, 'WAIT')
    assert.equal(body.result.recommendations.length, 2)
    assert.match(body.result.bengaliLearning.upScenario, /[\u0980-\u09FF]/)
  } finally {
    globalThis.fetch = nativeFetch
    server.close()
  }
})
