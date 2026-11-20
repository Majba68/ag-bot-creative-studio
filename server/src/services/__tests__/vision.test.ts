import assert from 'node:assert/strict'
import test from 'node:test'
import { parseVisionResponse } from '../vision.js'

const baseResponse = {
  verdict: 'UP',
  confidence: 88,
  summary: 'Several higher highs and a higher low are visible across the chart.',
  upScenario: 'A close above the visible resistance zone would keep the UP reading valid.',
  downScenario: 'A rejection from that zone would weaken the UP reading.',
  observedFacts: ['The last six candles trend higher.', 'A higher low is visible.'],
  interpretations: ['The structure may show buyer control.'],
  detectedPatterns: ['Higher lows'],
  bullishEvidence: ['Higher lows are visible.'],
  bearishEvidence: [],
  supportResistance: ['A horizontal resistance line is drawn near the upper chart.'],
  trendStrength: 'Moderate',
  conflictingIndicators: [],
  missingInformation: ['The exact RSI value is unreadable.'],
  alternativeScenarios: ['A pullback may form before continuation.'],
  requestAnotherScreenshot: false,
}

test('vision parser accepts structured model output and caps confidence below certainty', () => {
  const result = parseVisionResponse(JSON.stringify({ ...baseResponse, confidence: 100 }), 'test-vision-model')
  assert.equal(result.verdict, 'UP')
  assert.equal(result.confidence, 95)
  assert.deepEqual(result.observedFacts, baseResponse.observedFacts)
  assert.equal(result.model, 'test-vision-model')
  assert.match(result.disclaimer, /not financial advice/i)
})

test('vision parser accepts fenced JSON but forces insufficient data when another screenshot is requested', () => {
  const raw = `\`\`\`json\n${JSON.stringify({ ...baseResponse, requestAnotherScreenshot: true, verdict: 'UP' })}\n\`\`\``
  const result = parseVisionResponse(raw, 'test-vision-model')
  assert.equal(result.verdict, 'INSUFFICIENT_DATA')
  assert.ok(result.confidence <= 15)
  assert.equal(result.requestAnotherScreenshot, true)
  assert.match(result.waitReason ?? '', /unclear/i)
})

test('vision parser forces WAIT when directional evidence is weak', () => {
  const result = parseVisionResponse(JSON.stringify({
    ...baseResponse,
    verdict: 'DOWN',
    observedFacts: ['A chart grid is visible.'],
    bullishEvidence: [],
    bearishEvidence: [],
    detectedPatterns: [],
  }), 'test-vision-model')
  assert.equal(result.verdict, 'WAIT')
  assert.ok(result.confidence <= 35)
  assert.match(result.waitReason ?? '', /evidence|facts/i)
})

test('vision parser rejects unsupported certainty language', () => {
  assert.throws(
    () => parseVisionResponse(JSON.stringify({ ...baseResponse, summary: 'This setup guarantees a winning candle.' }), 'test-vision-model'),
    /unsupported certainty language/i,
  )
})

test('vision parser rejects an invalid verdict', () => {
  assert.throws(
    () => parseVisionResponse(JSON.stringify({ ...baseResponse, verdict: 'PROFIT' }), 'test-vision-model'),
    /valid verdict/i,
  )
})
