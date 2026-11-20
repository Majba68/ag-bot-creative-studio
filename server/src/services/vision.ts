import type { VisionAnalysis, VisionSettings, VisionVerdict } from '../types.js'

const unsupportedClaims = /\b(guarantee(?:d|s)?|certain(?:ly)?|will definitely|100\s*%|no risk|sure (?:win|profit)|always profit|never lose|can't lose)\b/i

const disclaimer =
  'AI vision output is an interpretation of visible pixels, not financial advice or a trade signal. ' +
  'Model confidence describes confidence in reading the evidence, not the probability of market success. ' +
  'No future candle direction or profit is guaranteed.'

export const VISION_SYSTEM_PROMPT = [
  'You are AG BOT Vision, a conservative analyst of trading-chart screenshots.',
  'Inspect the actual uploaded image. Describe only what is clearly visible. Never invent candle values, indicator values, price labels, pair names, timeframes, or patterns that are not legible.',
  'Compare several visible candles where available: direction, previous formations, momentum, market structure, rejection wicks, and conflicting signals. Do not judge only the newest candle.',
  'Strictly separate observed facts (what the pixels show) from interpretations (what those observations may suggest).',
  'Recognise common formations only when clearly visible, including engulfing, doji, hammer, shooting star, continuation and reversal structures.',
  'Report support and resistance only when zones, lines, or clearly repeated price areas are visible. If values are unreadable, say so in missingInformation.',
  'If the image is not a clear trading chart, is blurred, cropped too tightly, or too ambiguous, set verdict to INSUFFICIENT_DATA and requestAnotherScreenshot to true.',
  'Do not force UP or DOWN. If bullish and bearish evidence is weak, mixed, or absent, return WAIT with a clear waitReason.',
  'Model confidence must be an integer from 0 to 95 describing confidence in the evidence reading only. It is not a market-success probability.',
  'Never claim certainty, guaranteed outcomes, no risk, sure profits, or 100% accuracy.',
  'Return ONLY one raw JSON object. No markdown, no code fences, no commentary outside the JSON.',
].join(' ')

export function buildVisionPrompt(settings: VisionSettings): string {
  return [
    `User-provided context (not verified by the image): ${settings.pair}, timeframe ${settings.timeframe},`,
    `${settings.duration}-minute candle duration, ${settings.marketType === 'otc' ? 'OTC/synthetic' : 'non-OTC'},`,
    `analysis depth: ${settings.depth}.`,
    'OTC instruments are broker-generated and have no independent data feed in AG BOT; analyse only the screenshot.',
    '',
    'Return a JSON object with exactly these keys:',
    '- verdict: "UP" | "DOWN" | "WAIT" | "INSUFFICIENT_DATA"',
    '- confidence: integer 0-95 (confidence in the evidence reading, not market probability)',
    '- summary: concise overall reading',
    '- upScenario: what would make the UP case valid',
    '- downScenario: what would make the DOWN case valid',
    '- waitReason: string, use when verdict is WAIT or INSUFFICIENT_DATA',
    '- observedFacts: string[] of clearly visible factual observations',
    '- interpretations: string[] of cautious interpretations, clearly labelled as such',
    '- detectedPatterns: string[] of recognisable candle or chart patterns',
    '- bullishEvidence: string[]',
    '- bearishEvidence: string[]',
    '- supportResistance: string[] of visible zones only',
    '- trendStrength: string',
    '- conflictingIndicators: string[]',
    '- missingInformation: string[]',
    '- alternativeScenarios: string[]',
    '- requestAnotherScreenshot: boolean',
    '',
    'Use empty arrays when nothing is visible. Do not fill arrays with guesses.',
  ].join('\n')
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  const candidates = [trimmed]

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fenced) candidates.push(fenced[1].trim())

  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1))

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate)
    } catch {
      // Try the next extraction strategy.
    }
  }
  throw new Error('The vision model did not return valid JSON.')
}

function textField(value: unknown, maxChars = 800): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, maxChars)
}

function stringArray(value: unknown, maxItems = 10, maxChars = 400): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => textField(item, maxChars))
    .filter(Boolean)
    .slice(0, maxItems)
}

function parseVerdict(value: unknown): VisionVerdict | null {
  if (value === 'UP' || value === 'DOWN' || value === 'WAIT' || value === 'INSUFFICIENT_DATA') return value
  return null
}

export function parseVisionResponse(raw: string, model: string): VisionAnalysis {
  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The vision model response was not a JSON object.')
  }

  const body = parsed as Record<string, unknown>
  const verdict = parseVerdict(body.verdict)
  if (!verdict) throw new Error('The vision model response had no valid verdict.')

  const rawConfidence = Number(body.confidence)
  if (!Number.isFinite(rawConfidence)) throw new Error('The vision model response had no valid confidence value.')

  const summary = textField(body.summary)
  const upScenario = textField(body.upScenario)
  const downScenario = textField(body.downScenario)
  const observedFacts = stringArray(body.observedFacts)
  const interpretations = stringArray(body.interpretations)
  const detectedPatterns = stringArray(body.detectedPatterns)
  const bullishEvidence = stringArray(body.bullishEvidence)
  const bearishEvidence = stringArray(body.bearishEvidence)
  const supportResistance = stringArray(body.supportResistance)
  const conflictingIndicators = stringArray(body.conflictingIndicators)
  const missingInformation = stringArray(body.missingInformation)
  const alternativeScenarios = stringArray(body.alternativeScenarios)
  const trendStrength = textField(body.trendStrength, 200) || 'Not clearly visible'
  const requestAnotherScreenshot = body.requestAnotherScreenshot === true

  if (!summary) throw new Error('The vision model response had no summary.')

  const allText = [
    summary, upScenario, downScenario, trendStrength,
    ...observedFacts, ...interpretations, ...detectedPatterns, ...bullishEvidence,
    ...bearishEvidence, ...supportResistance, ...conflictingIndicators,
    ...missingInformation, ...alternativeScenarios, textField(body.waitReason, 400),
  ].join(' ')
  if (unsupportedClaims.test(allText)) {
    throw new Error('The vision model used unsupported certainty language, so the result was rejected.')
  }

  let finalVerdict: VisionVerdict = verdict
  let finalConfidence = Math.max(0, Math.min(95, Math.round(rawConfidence)))
  let waitReason = textField(body.waitReason, 400) || undefined

  if (requestAnotherScreenshot) {
    finalVerdict = 'INSUFFICIENT_DATA'
    finalConfidence = Math.min(finalConfidence, 15)
    waitReason ||= 'The screenshot is too unclear for a reliable reading. Please upload another sharper, uncropped chart image.'
  } else {
    let forcedReason = ''
    if (observedFacts.length < 2) {
      forcedReason = 'Too few clearly observable candle facts were visible to support a directional reading.'
    } else if (bullishEvidence.length === 0 && bearishEvidence.length === 0) {
      forcedReason = 'No clearly visible bullish or bearish evidence was reported.'
    } else if (verdict === 'UP' && bullishEvidence.length === 0) {
      forcedReason = 'An UP reading requires visible bullish evidence, which was not reported.'
    } else if (verdict === 'DOWN' && bearishEvidence.length === 0) {
      forcedReason = 'A DOWN reading requires visible bearish evidence, which was not reported.'
    }

    if (forcedReason) {
      finalVerdict = 'WAIT'
      finalConfidence = Math.min(finalConfidence, 35)
      waitReason ||= forcedReason
    }
  }

  if ((finalVerdict === 'WAIT' || finalVerdict === 'INSUFFICIENT_DATA') && !waitReason) {
    waitReason = 'The visible evidence is mixed, incomplete or unclear, so no directional reading is justified.'
  }

  return {
    verdict: finalVerdict,
    confidence: finalConfidence,
    summary,
    upScenario: upScenario || 'No clearly visible UP scenario was described.',
    downScenario: downScenario || 'No clearly visible DOWN scenario was described.',
    waitReason,
    observedFacts,
    interpretations,
    detectedPatterns,
    bullishEvidence,
    bearishEvidence,
    supportResistance,
    trendStrength,
    conflictingIndicators,
    missingInformation,
    alternativeScenarios,
    requestAnotherScreenshot,
    model,
    timestamp: new Date().toISOString(),
    disclaimer,
  }
}
