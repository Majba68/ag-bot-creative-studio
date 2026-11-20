import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import express from 'express'
import { parseDirectionProResponse } from '../directionPro.js'

const mockModelResponse = {
  enoughEvidence: true,
  summary: 'The chart is readable near 1.0950 on the visible axis and leans upward.',
  screenshot: {
    pairVisible: 'EUR/USD',
    timeframeVisible: '5min',
    chartReadable: true,
    candlesVisible: true,
    indicatorsReadable: true,
    observedFacts: ['Green candles dominate the recent visible sequence.', 'Higher lows are visible.'],
    missingInformation: ['Exact indicator settings are not legible.'],
  },
  advancedAnalysis: {
    marketTrend: 'The visible structure is mildly upward.',
    candlestickPatterns: ['Several bullish bodies with small upper wicks.'],
    supportResistance: ['A repeated reaction area near 1.0950 in the lower half of the visible chart.'],
    rsiMacd: 'RSI and MACD are not visible in the screenshot.',
    movingAverages: 'A single moving-average line is visible, but its period is not legible.',
    momentum: 'Momentum appears positive in the visible window.',
    breakoutReversal: ['No confirmed breakout is visible; a small upward continuation is visible.'],
  },
  decision: {
    verdict: 'UP_BIAS',
    confidence: 68,
    whySelected: 'More visible evidence supports upward continuation than downward reversal.',
    supportingSignals: ['Higher lows are visible.', 'Bullish candle bodies dominate the recent sequence.'],
    disagreeingSignals: ['A few red candles show pullbacks.'],
    invalidation: ['A close below the visible repeated reaction area would weaken this reading.'],
  },
  bengaliExplanation: {
    summary: 'চার্টের দৃশ্যমান অংশে উপরের দিকের প্রবণতা বেশি দেখা যাচ্ছে।',
    whySelected: 'বেশি মোমবাতি ও উঠতি নিচু স্তর উপরের দিকের ইঙ্গিত দিয়েছে।',
    howToRead: 'আগে মোমবাতির গতি দেখুন, তারপর দৃশ্যমান ইঙ্গিতগুলোর মিল যাচাই করুন।',
    upScenario: 'উপরের দিকে যাওয়া শুধু একটি সম্ভাব্য পরিস্থিতি; পরের মোমবাতি উঠবে এমন দাবি করা হয় না।',
    downScenario: 'নিচের দিকে যাওয়াও শুধু একটি সম্ভাব্য পরিস্থিতি; কোনো নিশ্চিত ফলাফল নেই।',
    riskNote: 'অস্পষ্ট বা মিশ্র ইঙ্গিতে কোনো ট্রেড সিদ্ধান্ত নেবেন না।',
  },
}

test('direction pro parser keeps a readable bias, strips prices and separates languages', () => {
  const result = parseDirectionProResponse(JSON.stringify(mockModelResponse), 'test-vision-model')

  assert.equal(result.enoughEvidence, true)
  assert.equal(result.decision.verdict, 'UP_BIAS')
  assert.equal(result.decision.supportingSignals.length, 2)
  assert.equal(result.screenshot.timeframeVisible, '5min')
  assert.doesNotMatch(result.summary, /1\.0950/)
  assert.doesNotMatch(result.advancedAnalysis.supportResistance.join(' '), /1\.0950/)
  assert.match(result.bengaliExplanation.summary, /[\u0980-\u09FF]/)
  assert.match(result.disclaimer, /SIMULATED|simulated/)
})

test('parser repairs a missing key quote emitted by the vision model', () => {
  const malformed = JSON.stringify(mockModelResponse).replace('"howToRead":', '"howToRead:')
  const result = parseDirectionProResponse(malformed, 'test-vision-model')

  assert.equal(result.decision.verdict, 'UP_BIAS')
  assert.equal(result.bengaliExplanation.howToRead, mockModelResponse.bengaliExplanation.howToRead)
})

test('parser repairs trailing commas in a model response', () => {
  const malformed = JSON.stringify(mockModelResponse).replace(
    '"invalidation": ["A close below the visible repeated reaction area would weaken this reading."]',
    '"invalidation": ["A close below the visible repeated reaction area would weaken this reading."],',
  )
  const result = parseDirectionProResponse(malformed, 'test-vision-model')

  assert.equal(result.decision.verdict, 'UP_BIAS')
  assert.equal(result.decision.disagreeingSignals.length, 1)
})

test('unreadable screenshots force INSUFFICIENT_EVIDENCE with no supporting signals', () => {
  const result = parseDirectionProResponse(JSON.stringify({
    ...mockModelResponse,
    enoughEvidence: false,
  }), 'test-vision-model')

  assert.equal(result.enoughEvidence, false)
  assert.equal(result.decision.verdict, 'INSUFFICIENT_EVIDENCE')
  assert.equal(result.decision.supportingSignals.length, 0)
  assert.match(result.bengaliExplanation.summary, /[\u0980-\u09FF]/)
})

test('readable screenshots without supporting evidence never force a bias', () => {
  const result = parseDirectionProResponse(JSON.stringify({
    ...mockModelResponse,
    decision: { ...mockModelResponse.decision, supportingSignals: [] },
  }), 'test-vision-model')

  assert.equal(result.decision.verdict, 'INSUFFICIENT_EVIDENCE')
  assert.equal(result.enoughEvidence, false)
})

test('Bengali script in English fields is rejected', () => {
  assert.throws(
    () => parseDirectionProResponse(JSON.stringify({
      ...mockModelResponse,
      summary: 'এই চার্টে উপরের প্রবণতা আছে।',
    }), 'test-vision-model'),
    /English report fields contained Bengali script/,
  )
})

test('English-only Bengali explanation is rejected', () => {
  assert.throws(
    () => parseDirectionProResponse(JSON.stringify({
      ...mockModelResponse,
      bengaliExplanation: {
        ...mockModelResponse.bengaliExplanation,
        whySelected: 'More evidence supports the upward bias.',
      },
    }), 'test-vision-model'),
    /Bengali explanation fields were incomplete/,
  )
})

test('negated certainty language is accepted as a disclaimer', () => {
  const result = parseDirectionProResponse(JSON.stringify({
    ...mockModelResponse,
    summary: 'This reading is not guaranteed and does not promise certainty.',
    decision: {
      ...mockModelResponse.decision,
      whySelected: 'The bias is based on visible evidence only; it is not certain.',
    },
    bengaliExplanation: {
      ...mockModelResponse.bengaliExplanation,
      upScenario: 'উপরের দিকের ইঙ্গিত শুধু একটি সম্ভাব্য পরিস্থিতি; পরের মোমবাতি অবশ্যই উঠবে না।',
    },
  }), 'test-vision-model')

  assert.equal(result.decision.verdict, 'UP_BIAS')
})

test('affirmative certainty and profit claims are still rejected', () => {
  assert.throws(
    () => parseDirectionProResponse(JSON.stringify({
      ...mockModelResponse,
      bengaliExplanation: {
        ...mockModelResponse.bengaliExplanation,
        upScenario: 'পরের মোমবাতি অবশ্যই উঠবে এবং নিশ্চিত লাভ পাবেন।',
      },
    }), 'test-vision-model'),
    /unsupported certainty language/,
  )

  assert.throws(
    () => parseDirectionProResponse(JSON.stringify({
      ...mockModelResponse,
      summary: 'This direction is guaranteed to win with 100% accuracy.',
    }), 'test-vision-model'),
    /unsupported certainty language/,
  )
})

test('demo verification uses simulated candles and never claims real market data', async () => {
  process.env.LLM_PROVIDER = 'openai'
  process.env.LLM_API_KEY = 'test-key-never-used'
  process.env.VISION_MODEL = 'gpt-4o-test'
  process.env.DEMO_MODE = 'true'

  const { directionProRouter } = await import('../../routes/directionPro.js')
  const app = express()
  app.use(express.json())
  app.use('/api/vision/direction-pro', directionProRouter)
  const server = app.listen(0)
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/vision/direction-pro/verify-demo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol: 'eur/usd', interval: '1min', horizon: 5 }),
    })
    const body = await response.json() as {
      available: boolean
      error?: string
      data: {
        simulated: true
        symbol: string
        interval: string
        horizon: number
        outcome: 'UP' | 'DOWN'
        basis: string
      } | null
    }

    assert.equal(response.status, 200)
    assert.equal(body.available, true)
    assert.ok(body.data)
    assert.equal(body.data.simulated, true)
    assert.equal(body.data.symbol, 'EUR/USD')
    assert.equal(body.data.interval, '1min')
    assert.equal(body.data.horizon, 5)
    assert.ok(body.data.outcome === 'UP' || body.data.outcome === 'DOWN')
    assert.match(body.data.basis, /No real market data is used/)
  } finally {
    server.close()
  }
})

test('direction pro route completes upload-to-analysis with a mocked vision provider', async () => {
  process.env.LLM_PROVIDER = 'openai'
  process.env.LLM_API_KEY = 'test-key-never-used'
  process.env.VISION_MODEL = 'gpt-4o-test'

  const nativeFetch = globalThis.fetch
  const { directionProRouter } = await import('../../routes/directionPro.js')

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
  app.use('/api/vision/direction-pro', directionProRouter)
  const server = app.listen(0)
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo

  try {
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64',
    )
    const form = new FormData()
    form.append('image', new File([bytes], 'quotex.png', { type: 'image/png' }))

    const response = await nativeFetch(`http://127.0.0.1:${port}/api/vision/direction-pro/analyze`, {
      method: 'POST',
      body: form,
    })
    const body = await response.json() as {
      available: boolean
      error?: string
      result: {
        model: string
        decision: { verdict: string }
        bengaliExplanation: { summary: string }
      } | null
    }

    assert.equal(response.status, 200)
    assert.equal(body.available, true)
    assert.equal(body.error, undefined)
    assert.ok(body.result)
    assert.equal(body.result.model, 'gpt-4o-test')
    assert.equal(body.result.decision.verdict, 'UP_BIAS')
    assert.match(body.result.bengaliExplanation.summary, /[\u0980-\u09FF]/)
  } finally {
    globalThis.fetch = nativeFetch
    server.close()
  }
})
