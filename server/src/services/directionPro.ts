import type {
  DirectionProAdvancedAnalysis,
  DirectionProAnalysis,
  DirectionProBengaliExplanation,
  DirectionProDecision,
  DirectionProScreenshot,
  DirectionProVerdict,
} from '../types.js'

const bengaliScript = /[\u0980-\u09FF]/

// These are always claims, even inside a "not/no" phrase, so they are rejected before negation handling.
const absoluteClaims = /\b(?:100\s*%|no risk|risk[- ]free|sure[- ]?(?:win|profit)|guaranteed\s+(?:win|profit|return))\b/i

// Certainty words are only unsafe when they are asserted, not when the model says they are absent.
const certaintyTerms = [
  /\bguarantee(?:d|s)?\b/i,
  /\bcertain(?:ly)?\b/i,
  /\bwill definitely\b/i,
  /\balways profit\b/i,
  /\bnever lose\b/i,
  /\bcan't lose\b/i,
  /নিশ্চিত/,
  /গ্যারান্টি/,
  /অবশ্যই/,
  /কখনো হারবেন না/,
]

const clauseNegation = /\b(?:not|no|never|without|cannot|can't|isn't|doesn't|won't|n't)\b|না|নয়|নেই/
const clauseSplit = /[.!?;,\n।]+/

const disclaimer =
  'This is an educational interpretation of visible pixels in one uploaded Quotex chart screenshot. ' +
  'It is not financial advice, not a trade signal, and never a guaranteed direction or profit. ' +
  'No exact price level is calculated or displayed; support and resistance are described relatively. ' +
  'Demo verification uses locally generated simulated candles and is never real market accuracy. ' +
  'Model confidence describes confidence in reading the evidence only.'

export const DIRECTION_PRO_SYSTEM_PROMPT = [
  'You are AG BOT Smart Direction Pro, a cautious educational analyst of Quotex chart screenshots.',
  'Inspect the actual uploaded image only. Describe only what is clearly visible. Never invent candles, indicator values, price labels, pair names, timeframes, patterns, or account settings.',
  'If the pair or timeframe is blurred or absent, return null for it and add it to missingInformation. Do not guess.',
  'Analyze the visible chart structure: market trend, candlestick patterns, support and resistance areas, RSI and MACD if actually visible, moving averages if visible, momentum, and breakout or reversal signals.',
  'Support and resistance must be described relatively, for example "a repeated reaction area in the upper third of the visible chart". Never return axis numbers, currency values, or exact price levels.',
  'Return exactly one primary verdict: UP_BIAS, DOWN_BIAS, or INSUFFICIENT_EVIDENCE. Use UP_BIAS or DOWN_BIAS only when the chart is readable and the chosen side has stronger visible supporting evidence.',
  'Use INSUFFICIENT_EVIDENCE when the screenshot is unreadable, not a chart, or has no usable chart information. Never force a direction to satisfy the request.',
  'Clearly separate supporting signals, disagreeing signals, and what would invalidate the reading. Never guarantee the next candle or any profit.',
  'If RSI, MACD, moving averages, or indicator labels are not clearly visible, state "Not visible in the screenshot." Do not estimate them.',
  'LANGUAGE RULE: every field except bengaliExplanation must be plain English. The bengaliExplanation object must be written in simple Bengali script. English tool names such as RSI, MACD, and Moving Average may appear inside Bengali sentences.',
  'Model confidence must be an integer from 0 to 95 and describes confidence in reading the screenshot, not the probability of a correct trade.',
  'Return ONLY one raw JSON object. No markdown, no code fences, no commentary outside the JSON.',
].join(' ')

export function buildDirectionProPrompt(): string {
  return [
    'Return a JSON object with exactly these keys:',
    '- enoughEvidence: boolean (false only when the image is unreadable or has no usable chart information)',
    '- summary: short English overall reading',
    '- screenshot: { pairVisible: string|null, timeframeVisible: string|null, chartReadable: boolean, candlesVisible: boolean, indicatorsReadable: boolean, observedFacts: string[], missingInformation: string[] }',
    '- advancedAnalysis: { marketTrend: string, candlestickPatterns: string[], supportResistance: string[], rsiMacd: string, movingAverages: string, momentum: string, breakoutReversal: string[] }',
    '- decision: { verdict: "UP_BIAS"|"DOWN_BIAS"|"INSUFFICIENT_EVIDENCE", confidence: number, whySelected: string, supportingSignals: string[], disagreeingSignals: string[], invalidation: string[] }',
    '- bengaliExplanation: { summary: string, whySelected: string, howToRead: string, upScenario: string, downScenario: string, riskNote: string }',
    '',
    'Use empty arrays when nothing is clear. Do not fill arrays with guesses.',
    'If enoughEvidence is false, the verdict must be INSUFFICIENT_EVIDENCE and supportingSignals must be empty, but still complete bengaliExplanation in Bengali.',
    'If the verdict is INSUFFICIENT_EVIDENCE, confidence must be low and whySelected must explain the lack of usable evidence.',
    'Do not ask for extra screenshots of indicator menus. At most, ask for one clearer full chart screenshot when the image is not legible.',
    'No exact prices, currency values, or axis numbers in any text field. Relative zone descriptions are acceptable.',
    'All fields except bengaliExplanation must be English. Every bengaliExplanation field must contain Bengali script.',
  ].join('\n')
}

/** Repairs two malformed JSON shapes occasionally emitted by vision models. */
function repairJson(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    // `"key: "value"` -> `"key": "value"`
    .replace(/"([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"/g, '"$1": "')
    // Remove trailing commas before a closing brace or bracket.
    .replace(/,\s*([}\]])/g, '$1')
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  const candidates = [trimmed]

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fenced) candidates.push(fenced[1].trim())

  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1))

  const allCandidates = [...candidates, ...candidates.map(repairJson)]
  for (const candidate of allCandidates) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate)
    } catch {
      // Try the next extraction or repair strategy.
    }
  }
  throw new Error('The vision model did not return valid JSON.')
}

/** Removes price-like values while keeping pair names, timeframes and short setting numbers. */
function cleanText(value: unknown, maxChars = 900): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\*\*/g, '')
    .replace(/(?:[$€£₹]\s*)?\d+(?:[.,]\d{2,})+/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxChars)
}

function stringArray(value: unknown, maxItems = 10, maxChars = 500): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => cleanText(item, maxChars))
    .filter(Boolean)
    .slice(0, maxItems)
}

/** Accepts a string or a short string array for narrative fields some models return as arrays. */
function singleText(value: unknown, maxChars = 900): string {
  if (typeof value === 'string') return cleanText(value, maxChars)
  if (Array.isArray(value)) return stringArray(value, 4, maxChars).join(' ')
  return ''
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function hasUnsupportedClaims(text: string): boolean {
  if (absoluteClaims.test(text)) return true

  return text
    .split(clauseSplit)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .some((clause) => {
      if (!certaintyTerms.some((pattern) => pattern.test(clause))) return false
      // "not guaranteed", "no certainty", "নিশ্চিত নয়", "নিশ্চিত ফলাফল নেই" etc. are disclaimers, not claims.
      return !clauseNegation.test(clause)
    })
}

function parseScreenshot(value: unknown): DirectionProScreenshot {
  const body = asObject(value)
  const pair = cleanText(body.pairVisible, 40)
  const timeframe = cleanText(body.timeframeVisible, 40)
  return {
    pairVisible: pair || null,
    timeframeVisible: timeframe || null,
    chartReadable: body.chartReadable === true,
    candlesVisible: body.candlesVisible === true,
    indicatorsReadable: body.indicatorsReadable === true,
    observedFacts: stringArray(body.observedFacts),
    missingInformation: stringArray(body.missingInformation),
  }
}

function parseAdvancedAnalysis(value: unknown): DirectionProAdvancedAnalysis {
  const body = asObject(value)
  return {
    marketTrend: singleText(body.marketTrend),
    candlestickPatterns: stringArray(body.candlestickPatterns),
    supportResistance: stringArray(body.supportResistance, 8),
    rsiMacd: singleText(body.rsiMacd),
    movingAverages: singleText(body.movingAverages),
    momentum: singleText(body.momentum),
    breakoutReversal: stringArray(body.breakoutReversal),
  }
}

function parseDecision(value: unknown, fallbackConfidence: number): DirectionProDecision {
  const body = asObject(value)
  const rawVerdict = body.verdict
  const verdict: DirectionProVerdict | null =
    rawVerdict === 'UP_BIAS' || rawVerdict === 'DOWN_BIAS' || rawVerdict === 'INSUFFICIENT_EVIDENCE'
      ? rawVerdict
      : null
  const rawConfidence = Number(body.confidence ?? fallbackConfidence)
  const confidence = Number.isFinite(rawConfidence)
    ? Math.max(0, Math.min(95, Math.round(rawConfidence)))
    : 15

  return {
    verdict: verdict ?? 'INSUFFICIENT_EVIDENCE',
    confidence,
    whySelected: singleText(body.whySelected),
    supportingSignals: stringArray(body.supportingSignals),
    disagreeingSignals: stringArray(body.disagreeingSignals),
    invalidation: stringArray(body.invalidation, 8),
  }
}

const BENGALI_DEFAULTS: DirectionProBengaliExplanation = {
  summary: 'স্ক্রিনশটের দৃশ্যমান তথ্যের ভিত্তিতে একটি শিক্ষামূলক মূল্যায়ন দেখানো হলো।',
  whySelected: 'এই মূল্যায়নটি শুধু চার্টে দৃশ্যমান ইঙ্গিতের তুলনার ওপর ভিত্তি করে দেওয়া হয়েছে; এটি নিশ্চিত ভবিষ্যদ্বাণী নয়।',
  howToRead: 'মোমবাতির গঠন, উচ্চ-নিম্ন স্তর, প্রবণতা এবং দৃশ্যমান সূচকগুলো একসাথে দেখুন। তথ্য অস্পষ্ট হলে অপেক্ষা করুন।',
  upScenario: 'দৃশ্যমান সহায়ক ইঙ্গিত থাকলে দাম উপরের দিকে যাওয়ার সম্ভাব্য পরিস্থিতি তৈরি হতে পারে, তবে নিশ্চিত কিছু নয়।',
  downScenario: 'দৃশ্যমান বিক্রয়চাপ বা দুর্বলতার ইঙ্গিত থাকলে দাম নিচের দিকে যাওয়ার সম্ভাব্য পরিস্থিতি তৈরি হতে পারে, তবে নিশ্চিত কিছু নয়।',
  riskNote: 'এটি কোনো ট্রেড নির্দেশনা বা লাভের নিশ্চয়তা নয়; অস্পষ্ট বা বিপরীত ইঙ্গিত থাকলে সতর্ক থাকুন।',
}

function parseBengaliExplanation(value: unknown): DirectionProBengaliExplanation {
  const body = asObject(value)
  const parsed = {
    summary: singleText(body.summary),
    whySelected: singleText(body.whySelected),
    howToRead: singleText(body.howToRead),
    upScenario: singleText(body.upScenario),
    downScenario: singleText(body.downScenario),
    riskNote: singleText(body.riskNote),
  }
  for (const key of Object.keys(parsed) as Array<keyof DirectionProBengaliExplanation>) {
    if (!bengaliScript.test(parsed[key])) parsed[key] = BENGALI_DEFAULTS[key]
  }
  return parsed
}

function collectResultText(result: DirectionProAnalysis): string {
  return [
    result.summary,
    result.screenshot.pairVisible ?? '',
    result.screenshot.timeframeVisible ?? '',
    ...result.screenshot.observedFacts,
    ...result.screenshot.missingInformation,
    result.advancedAnalysis.marketTrend,
    ...result.advancedAnalysis.candlestickPatterns,
    ...result.advancedAnalysis.supportResistance,
    result.advancedAnalysis.rsiMacd,
    result.advancedAnalysis.movingAverages,
    result.advancedAnalysis.momentum,
    ...result.advancedAnalysis.breakoutReversal,
    result.decision.whySelected,
    ...result.decision.supportingSignals,
    ...result.decision.disagreeingSignals,
    ...result.decision.invalidation,
    ...Object.values(result.bengaliExplanation),
  ].join(' ')
}

function validateLanguages(result: DirectionProAnalysis): void {
  const englishFields = [
    result.summary,
    result.screenshot.pairVisible ?? '',
    result.screenshot.timeframeVisible ?? '',
    ...result.screenshot.observedFacts,
    ...result.screenshot.missingInformation,
    result.advancedAnalysis.marketTrend,
    ...result.advancedAnalysis.candlestickPatterns,
    ...result.advancedAnalysis.supportResistance,
    result.advancedAnalysis.rsiMacd,
    result.advancedAnalysis.movingAverages,
    result.advancedAnalysis.momentum,
    ...result.advancedAnalysis.breakoutReversal,
    result.decision.whySelected,
    ...result.decision.supportingSignals,
    ...result.decision.disagreeingSignals,
    ...result.decision.invalidation,
  ]

  if (englishFields.some((field) => bengaliScript.test(field))) {
    throw new Error('English report fields contained Bengali script, so the result was rejected.')
  }
  // Bengali explanation fields are normalized during parsing with safe defaults.
}

function insufficientResult(model: string, reason: string, rawConfidence = 15): DirectionProAnalysis {
  return {
    enoughEvidence: false,
    summary: reason,
    screenshot: {
      pairVisible: null,
      timeframeVisible: null,
      chartReadable: false,
      candlesVisible: false,
      indicatorsReadable: false,
      observedFacts: [],
      missingInformation: [reason],
    },
    advancedAnalysis: {
      marketTrend: 'Not readable in the uploaded screenshot.',
      candlestickPatterns: [],
      supportResistance: [],
      rsiMacd: 'Not visible in the screenshot.',
      movingAverages: 'Not visible in the screenshot.',
      momentum: 'Not readable in the uploaded screenshot.',
      breakoutReversal: [],
    },
    decision: {
      verdict: 'INSUFFICIENT_EVIDENCE',
      confidence: Math.max(0, Math.min(15, Math.round(rawConfidence))),
      whySelected: reason,
      supportingSignals: [],
      disagreeingSignals: [],
      invalidation: [],
    },
    bengaliExplanation: {
      summary: 'এই স্ক্রিনশটে চার্টের তথ্য পর্যাপ্তভাবে পড়া যায়নি, তাই কোনো দিক নির্ধারণ করা হয়নি।',
      whySelected: 'অস্পষ্ট বা অব্যবহৃত চার্ট থেকে UP বা DOWN বেছে নেওয়া হলে তা অনুমান হয়ে যেত।',
      howToRead: 'প্রথমে পরিষ্কার মোমবাতি, সময়সীমা ও দৃশ্যমান ইঙ্গিত থাকা চার্টের স্ক্রিনশট নিন; তারপর আবার বিশ্লেষণ করুন।',
      upScenario: 'উপরের দিকের ইঙ্গিত শুধু একটি সম্ভাব্য পরিস্থিতি; এখানে তার কোনো নির্ভরযোগ্য প্রমাণ পাওয়া যায়নি।',
      downScenario: 'নিচের দিকের ইঙ্গিতও শুধু একটি সম্ভাব্য পরিস্থিতি; এখানে তার কোনো নির্ভরযোগ্য প্রমাণ পাওয়া যায়নি।',
      riskNote: 'অস্পষ্ট তথ্যের ওপর ভিত্তি করে কোনো ট্রেড সিদ্ধান্ত নেবেন না; এটি শুধু শিক্ষামূলক পর্যবেক্ষণ।',
    },
    model,
    timestamp: new Date().toISOString(),
    disclaimer,
  }
}

export function parseDirectionProResponse(raw: string, model: string): DirectionProAnalysis {
  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The vision model response was not a JSON object.')
  }

  const body = parsed as Record<string, unknown>
  if (typeof body.enoughEvidence !== 'boolean') {
    throw new Error('The vision model response had no valid evidence decision.')
  }

  const decisionBody = asObject(body.decision)
  const rawConfidence = Number(body.confidence ?? decisionBody.confidence)
  if (!Number.isFinite(rawConfidence)) {
    throw new Error('The vision model response had no valid confidence value.')
  }

  const summary = cleanText(body.summary)
  if (!summary) throw new Error('The vision model response had no summary.')

  const result: DirectionProAnalysis = {
    enoughEvidence: body.enoughEvidence,
    summary,
    screenshot: parseScreenshot(body.screenshot),
    advancedAnalysis: parseAdvancedAnalysis(body.advancedAnalysis),
    decision: parseDecision(body.decision, rawConfidence),
    bengaliExplanation: parseBengaliExplanation(body.bengaliExplanation),
    model,
    timestamp: new Date().toISOString(),
    disclaimer,
  }

  validateLanguages(result)
  if (hasUnsupportedClaims(collectResultText(result))) {
    throw new Error('The vision model used unsupported certainty language, so the result was rejected.')
  }

  if (!result.enoughEvidence) {
    return insufficientResult(model, summary, rawConfidence)
  }

  const hasUsableDirection =
    result.screenshot.chartReadable &&
    result.screenshot.candlesVisible &&
    result.screenshot.observedFacts.length >= 2 &&
    result.advancedAnalysis.marketTrend.length > 0 &&
    result.decision.whySelected.length > 0 &&
    result.decision.supportingSignals.length > 0 &&
    (result.decision.verdict === 'UP_BIAS' || result.decision.verdict === 'DOWN_BIAS')

  if (!hasUsableDirection) {
    return insufficientResult(
      model,
      'The screenshot does not provide enough usable chart information for a direction bias.',
      rawConfidence,
    )
  }

  return result
}
