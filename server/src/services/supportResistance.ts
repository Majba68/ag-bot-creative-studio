import type {
  SupportResistanceAnalysis,
  SupportResistanceZone,
  SupportResistanceZoneType,
} from '../types.js'

const unsupportedClaims = /\b(guarantee(?:d|s)?|certain(?:ly)?|will definitely|100\s*%|no risk|sure (?:win|profit)|always profit|never lose|can't lose)\b/i

const disclaimer =
  'This is an educational interpretation of visible pixels, not financial advice or a trade signal. ' +
  'No exact price level is calculated or displayed. A possible breakout or breakdown is a scenario to study, ' +
  'not a guaranteed UP or DOWN prediction. Model confidence describes confidence in reading the evidence only.'

export const SUPPORT_RESISTANCE_SYSTEM_PROMPT = [
  'You are AG BOT Support & Resistance Vision, a conservative analyst of trading-chart screenshots.',
  'Inspect the actual uploaded image. Describe only what is clearly visible. Never invent candles, indicator values, price labels, pair names, timeframes, or patterns that are not legible.',
  'Identify potential support and resistance zones only when repeated price areas, horizontal lines, rejection wicks, or obvious turning areas are visible.',
  'For each zone, give yPercent: the approximate vertical position as a percentage of the image height, where 0 is the very top and 100 is the very bottom. Use a number from 2 to 98.',
  'Do not return, quote, estimate, or invent any exact price value. yPercent is only a canvas position, never a price.',
  'Return at most 3 support zones and 3 resistance zones. If the evidence is unclear, return an empty zones array.',
  'Explain in simple language why an area may be support, why an area may be resistance, what a possible breakout above resistance could mean, and what a possible breakdown below support could mean.',
  'Clearly separate observed facts from interpretations. Do not give a guaranteed UP or DOWN prediction.',
  'If the image is blurred, not a chart, cropped too tightly, or too ambiguous, set enoughEvidence to false and requestAnotherScreenshot to true.',
  'Model confidence must be an integer from 0 to 95 describing confidence in the evidence reading only. It is not a market-success probability.',
  'Never claim certainty, guaranteed outcomes, no risk, sure profits, or 100% accuracy.',
  'Return ONLY one raw JSON object. No markdown, no code fences, no commentary outside the JSON.',
].join(' ')

export function buildSupportResistancePrompt(): string {
  return [
    'Return a JSON object with exactly these keys:',
    '- enoughEvidence: boolean',
    '- summary: concise plain-language overall reading',
    '- supportWhy: why the marked area may be support',
    '- resistanceWhy: why the marked area may be resistance',
    '- breakoutMeaning: educational meaning of a possible move above resistance',
    '- breakdownMeaning: educational meaning of a possible move below support',
    '- observedFacts: string[] of clearly visible factual observations',
    '- missingInformation: string[] of information the screenshot does not provide',
    '- requestAnotherScreenshot: boolean',
    '- confidence: integer 0-95 (confidence in evidence reading, not market probability)',
    '- zones: array of objects with exactly { type: "support" | "resistance", yPercent: number, reason: string, strength: "weak" | "moderate" | "strong" }',
    '',
    'Use empty arrays when nothing is clear. Do not fill arrays with guesses.',
    'If enoughEvidence is false, zones must be an empty array.',
    'Do not include exact prices, currency values, or axis numbers in any text field.',
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

/** Removes price-like values so the UI never displays invented or unreadable levels. */
function cleanText(value: unknown, maxChars = 800): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\*\*/g, '')
    .replace(/(?:[$€£₹]\s*)?\d+(?:[.,]\d{2,})+/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxChars)
}

function stringArray(value: unknown, maxItems = 8, maxChars = 400): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => cleanText(item, maxChars))
    .filter(Boolean)
    .slice(0, maxItems)
}

function parseZones(value: unknown): SupportResistanceZone[] {
  if (!Array.isArray(value)) return []
  const zones: SupportResistanceZone[] = []

  for (const item of value.slice(0, 8)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const body = item as Record<string, unknown>
    const type: SupportResistanceZoneType | null =
      body.type === 'support' || body.type === 'resistance' ? body.type : null
    const yPercent = Number(body.yPercent)
    const reason = cleanText(body.reason, 260)
    const strength = body.strength === 'weak' || body.strength === 'strong'
      ? body.strength
      : 'moderate'

    if (!type || !Number.isFinite(yPercent) || yPercent < 2 || yPercent > 98 || !reason) continue
    if (zones.some((zone) => zone.type === type && Math.abs(zone.yPercent - yPercent) < 1.5)) continue

    zones.push({
      type,
      yPercent: Math.round(yPercent * 10) / 10,
      reason,
      strength,
    })
  }

  return zones.slice(0, 6)
}

function insufficientResult(model: string, reason: string, rawConfidence = 15): SupportResistanceAnalysis {
  return {
    enoughEvidence: false,
    summary: reason,
    supportWhy: 'No reliable support area was identified in this screenshot.',
    resistanceWhy: 'No reliable resistance area was identified in this screenshot.',
    breakoutMeaning: 'If a later chart shows price moving above a resistance area, that is a possible breakout scenario to study. It is not a guaranteed direction.',
    breakdownMeaning: 'If a later chart shows price moving below a support area, that is a possible breakdown scenario to study. It is not a guaranteed direction.',
    observedFacts: [],
    missingInformation: [reason],
    requestAnotherScreenshot: true,
    confidence: Math.max(0, Math.min(15, Math.round(rawConfidence))),
    zones: [],
    model,
    timestamp: new Date().toISOString(),
    disclaimer,
  }
}

export function parseSupportResistanceResponse(raw: string, model: string): SupportResistanceAnalysis {
  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The vision model response was not a JSON object.')
  }

  const body = parsed as Record<string, unknown>
  if (typeof body.enoughEvidence !== 'boolean') {
    throw new Error('The vision model response had no valid evidence decision.')
  }

  const rawConfidence = Number(body.confidence)
  if (!Number.isFinite(rawConfidence)) {
    throw new Error('The vision model response had no valid confidence value.')
  }
  const confidence = Math.max(0, Math.min(95, Math.round(rawConfidence)))

  const summary = cleanText(body.summary)
  const supportWhy = cleanText(body.supportWhy)
  const resistanceWhy = cleanText(body.resistanceWhy)
  const breakoutMeaning = cleanText(body.breakoutMeaning)
  const breakdownMeaning = cleanText(body.breakdownMeaning)
  const observedFacts = stringArray(body.observedFacts)
  const missingInformation = stringArray(body.missingInformation)
  const requestAnotherScreenshot = body.requestAnotherScreenshot === true
  const zones = parseZones(body.zones)

  if (!summary) throw new Error('The vision model response had no summary.')

  const allText = [
    summary, supportWhy, resistanceWhy, breakoutMeaning, breakdownMeaning,
    ...observedFacts, ...missingInformation, ...zones.map((zone) => zone.reason),
  ].join(' ')
  if (unsupportedClaims.test(allText)) {
    throw new Error('The vision model used unsupported certainty language, so the result was rejected.')
  }

  if (requestAnotherScreenshot || !body.enoughEvidence) {
    return insufficientResult(model, summary, confidence)
  }
  if (zones.length === 0 || observedFacts.length < 2 || !supportWhy || !resistanceWhy) {
    return insufficientResult(
      model,
      'The screenshot does not provide enough clear evidence to draw reliable support or resistance lines.',
      confidence,
    )
  }

  return {
    enoughEvidence: true,
    summary,
    supportWhy,
    resistanceWhy,
    breakoutMeaning: breakoutMeaning || 'A move above the marked resistance would be a possible breakout scenario. It is not a guaranteed direction.',
    breakdownMeaning: breakdownMeaning || 'A move below the marked support would be a possible breakdown scenario. It is not a guaranteed direction.',
    observedFacts,
    missingInformation,
    requestAnotherScreenshot: false,
    confidence,
    zones,
    model,
    timestamp: new Date().toISOString(),
    disclaimer,
  }
}
