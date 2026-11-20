import type {
  SmartChartBengaliLearning,
  SmartChartClutterRisk,
  SmartChartDirection,
  SmartChartDirectionVerdict,
  SmartChartRecommendation,
  SmartChartScreenshotReview,
  SmartChartSetupAnalysis,
  SmartChartSetupGuide,
  SmartChartToolCategory,
} from '../types.js'

const bengaliScript = /[\u0980-\u09FF]/

const unsupportedClaims = /\b(guarantee(?:d|s)?|certain(?:ly)?|will definitely|100\s*%|sure (?:win|profit)|always profit|never lose|can't lose|নিশ্চিত|গ্যারান্টি|অবশ্যই|নিশ্চিত লাভ)\b/i

const disclaimer =
  'This is an educational chart-setup review based only on visible pixels in the uploaded dashboard screenshot. ' +
  'It is not financial advice, not a trade signal, and it never predicts the next candle. ' +
  'Tool names and suggested settings are study suggestions, not confirmed account settings. ' +
  'Model confidence describes confidence in reading the evidence, not the probability of market success.'

export const SMART_CHART_SETUP_SYSTEM_PROMPT = [
  'You are AG BOT Smart Chart Setup, a conservative educational analyst of full trading-dashboard screenshots.',
  'Inspect the actual uploaded image only. It is one full dashboard screenshot. Never ask for separate screenshots of indicator menus or settings panels.',
  'Describe only what is clearly visible: the chart area, candles, timeframe label, and any indicator labels or plotted lines that can actually be read.',
  'Never invent candlestick values, indicator values, price labels, pair names, timeframes, patterns, account settings, or hidden menu options.',
  'If a label is blurred or absent, say it is not legible and place it in missingInformation. Do not guess it.',
  'Recommend useful study tools from: RSI, MACD, Moving Average, Bollinger Bands, ZigZag, Horizontal Line, Trend Line, Support and Resistance, Fibonacci tools.',
  'For every recommendation give: exact tool name in English, category, why it may be useful, suggested settings when appropriate, whether it is optional, clutter risk, and a short clutter note when relevant.',
  'Never claim that a recommended tool is already installed unless its label or plot is clearly visible in the screenshot.',
  'Candle direction analysis must separate visible UP evidence, visible DOWN evidence, conflicting signals, and whether enough information exists.',
  'Use verdict WAIT or INSUFFICIENT_DATA when evidence is mixed, unclear, or missing. Never guarantee the next candle direction or any profit.',
  'Do not return, quote, estimate, or invent exact price values. Settings such as 14-period or 20/50 are allowed; price levels are not.',
  'LANGUAGE RULE: every field except the bengaliLearning object must be written in plain English. Tool names and settings always stay in English.',
  'The bengaliLearning object must be written in simple Bengali script (Bangla). Do not write its explanations in English.',
  'Model confidence must be an integer from 0 to 95 and describes confidence in reading the screenshot only.',
  'Return ONLY one raw JSON object. No markdown, no code fences, no commentary outside the JSON.',
].join(' ')

export function buildSmartChartSetupPrompt(): string {
  return [
    'Return a JSON object with exactly these keys:',
    '- enoughEvidence: boolean (false only if the image is not a usable dashboard/chart screenshot)',
    '- summary: short English overall reading',
    '- screenshot: { chartVisible: boolean, candlesVisible: boolean, timeframeVisible: string|null, visibleIndicators: string[], chartStructure: string, observedFacts: string[], missingInformation: string[] }',
    '- recommendations: array of { name: string, category: "indicator"|"drawing", whyUseful: string, suggestedSettings: string, optional: boolean, clutterRisk: "low"|"medium"|"high", clutterNote?: string }',
    '- setupGuide: { indicatorsToConsider: string[], drawingToolsToConsider: string[], settingsAndConfigurations: string[], howToCombine: string[], howToReadCombinedChart: string[] }',
    '- direction: { enoughInformation: boolean, verdict: "UP"|"DOWN"|"WAIT"|"INSUFFICIENT_DATA", confidence: number, upEvidence: string[], downEvidence: string[], conflictingSignals: string[], waitReason?: string, requestAnotherScreenshot: boolean }',
    '- bengaliLearning: { toolsToUse: string[], whyToolsHelp: string[], howToConfigure: string[], howToReadChart: string[], upScenario: string, downScenario: string, waitGuidance: string }',
    '',
    'Use empty arrays when nothing is clear. Do not fill arrays with guesses.',
    'If enoughEvidence is false, keep recommendations and setupGuide empty but still complete bengaliLearning in Bengali.',
    'If direction.enoughInformation is false, verdict must be WAIT or INSUFFICIENT_DATA and waitReason must explain why.',
    'Do not ask for more screenshots of menus. At most, ask for one clearer full-dashboard screenshot when the image is not legible.',
    'No exact prices, currency values, or axis numbers in any text field. Plain short setting numbers are acceptable.',
    'All fields except bengaliLearning must be English. Every bengaliLearning field must contain Bengali script.',
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

/** Removes price-like values while keeping short settings such as 14-period or 20/50. */
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
  const softened = text
    .replace(/\bnot\s+guaranteed\b/gi, '')
    .replace(/\bno\s+guarantee\b/gi, '')
    .replace(/\bnever\s+guaranteed\b/gi, '')
    .replace(/\bnot\s+certain\b/gi, '')
    .replace(/নিশ্চিত\s+নয়/g, '')
    .replace(/গ্যারান্টি\s+নয়/g, '')
  return unsupportedClaims.test(softened)
}

function parseRecommendations(value: unknown): SmartChartRecommendation[] {
  if (!Array.isArray(value)) return []
  const recommendations: SmartChartRecommendation[] = []

  for (const item of value.slice(0, 12)) {
    const body = asObject(item)
    const name = cleanText(body.name, 80)
    const category: SmartChartToolCategory | null =
      body.category === 'indicator' || body.category === 'drawing' ? body.category : null
    const whyUseful = cleanText(body.whyUseful, 600)
    const suggestedSettings = cleanText(body.suggestedSettings, 300)
    const clutterRisk: SmartChartClutterRisk =
      body.clutterRisk === 'medium' || body.clutterRisk === 'high' ? body.clutterRisk : 'low'

    if (!name || !category || !whyUseful || !suggestedSettings) continue
    recommendations.push({
      name,
      category,
      whyUseful,
      suggestedSettings,
      optional: body.optional === true,
      clutterRisk,
      clutterNote: cleanText(body.clutterNote, 300) || undefined,
    })
  }

  return recommendations.slice(0, 10)
}

function parseScreenshot(value: unknown): SmartChartScreenshotReview {
  const body = asObject(value)
  const timeframe = cleanText(body.timeframeVisible, 60)
  return {
    chartVisible: body.chartVisible === true,
    candlesVisible: body.candlesVisible === true,
    timeframeVisible: timeframe || null,
    visibleIndicators: stringArray(body.visibleIndicators, 10, 80),
    chartStructure: cleanText(body.chartStructure),
    observedFacts: stringArray(body.observedFacts),
    missingInformation: stringArray(body.missingInformation),
  }
}

function parseSetupGuide(value: unknown): SmartChartSetupGuide {
  const body = asObject(value)
  return {
    indicatorsToConsider: stringArray(body.indicatorsToConsider, 10, 80),
    drawingToolsToConsider: stringArray(body.drawingToolsToConsider, 10, 80),
    settingsAndConfigurations: stringArray(body.settingsAndConfigurations, 10),
    howToCombine: stringArray(body.howToCombine, 10),
    howToReadCombinedChart: stringArray(body.howToReadCombinedChart, 10),
  }
}

function parseDirection(value: unknown): SmartChartDirection {
  const body = asObject(value)
  const rawVerdict = body.verdict
  const verdict: SmartChartDirectionVerdict =
    rawVerdict === 'UP' || rawVerdict === 'DOWN' || rawVerdict === 'WAIT' || rawVerdict === 'INSUFFICIENT_DATA'
      ? rawVerdict
      : 'WAIT'
  const rawConfidence = Number(body.confidence)
  const confidence = Number.isFinite(rawConfidence)
    ? Math.max(0, Math.min(95, Math.round(rawConfidence)))
    : 15

  return {
    enoughInformation: body.enoughInformation === true,
    verdict,
    confidence,
    upEvidence: stringArray(body.upEvidence),
    downEvidence: stringArray(body.downEvidence),
    conflictingSignals: stringArray(body.conflictingSignals),
    waitReason: cleanText(body.waitReason, 600) || undefined,
    requestAnotherScreenshot: body.requestAnotherScreenshot === true,
  }
}

function parseBengaliLearning(value: unknown): SmartChartBengaliLearning {
  const body = asObject(value)
  return {
    toolsToUse: stringArray(body.toolsToUse, 10),
    whyToolsHelp: stringArray(body.whyToolsHelp, 10),
    howToConfigure: stringArray(body.howToConfigure, 10),
    howToReadChart: stringArray(body.howToReadChart, 10),
    upScenario: singleText(body.upScenario),
    downScenario: singleText(body.downScenario),
    waitGuidance: singleText(body.waitGuidance),
  }
}

function collectResultText(result: SmartChartSetupAnalysis): string {
  return [
    result.summary,
    result.screenshot.chartStructure,
    result.screenshot.timeframeVisible ?? '',
    ...result.screenshot.visibleIndicators,
    ...result.screenshot.observedFacts,
    ...result.screenshot.missingInformation,
    ...result.recommendations.flatMap((item) => [
      item.name, item.whyUseful, item.suggestedSettings, item.clutterNote ?? '',
    ]),
    ...result.setupGuide.indicatorsToConsider,
    ...result.setupGuide.drawingToolsToConsider,
    ...result.setupGuide.settingsAndConfigurations,
    ...result.setupGuide.howToCombine,
    ...result.setupGuide.howToReadCombinedChart,
    ...result.direction.upEvidence,
    ...result.direction.downEvidence,
    ...result.direction.conflictingSignals,
    result.direction.waitReason ?? '',
    ...result.bengaliLearning.toolsToUse,
    ...result.bengaliLearning.whyToolsHelp,
    ...result.bengaliLearning.howToConfigure,
    ...result.bengaliLearning.howToReadChart,
    result.bengaliLearning.upScenario,
    result.bengaliLearning.downScenario,
    result.bengaliLearning.waitGuidance,
  ].join(' ')
}

function validateLanguages(result: SmartChartSetupAnalysis): void {
  const englishFields = [
    result.summary,
    result.screenshot.chartStructure,
    result.screenshot.timeframeVisible ?? '',
    ...result.screenshot.visibleIndicators,
    ...result.screenshot.observedFacts,
    ...result.screenshot.missingInformation,
    ...result.recommendations.flatMap((item) => [
      item.name, item.whyUseful, item.suggestedSettings, item.clutterNote ?? '',
    ]),
    ...result.setupGuide.indicatorsToConsider,
    ...result.setupGuide.drawingToolsToConsider,
    ...result.setupGuide.settingsAndConfigurations,
    ...result.setupGuide.howToCombine,
    ...result.setupGuide.howToReadCombinedChart,
    ...result.direction.upEvidence,
    ...result.direction.downEvidence,
    ...result.direction.conflictingSignals,
    result.direction.waitReason ?? '',
  ]

  if (englishFields.some((field) => bengaliScript.test(field))) {
    throw new Error('English report fields contained Bengali script, so the result was rejected.')
  }

  // Tool names must stay in English, so only the narrative learning fields are checked for Bengali script.
  const bengaliFields = [
    ...result.bengaliLearning.whyToolsHelp,
    ...result.bengaliLearning.howToConfigure,
    ...result.bengaliLearning.howToReadChart,
    result.bengaliLearning.upScenario,
    result.bengaliLearning.downScenario,
    result.bengaliLearning.waitGuidance,
  ]
  if (!bengaliFields.length || bengaliFields.some((field) => !bengaliScript.test(field))) {
    throw new Error('The Bengali learning fields were incomplete, so the result was rejected.')
  }
}

function insufficientResult(model: string, reason: string, rawConfidence = 15): SmartChartSetupAnalysis {
  return {
    enoughEvidence: false,
    summary: reason,
    screenshot: {
      chartVisible: false,
      candlesVisible: false,
      timeframeVisible: null,
      visibleIndicators: [],
      chartStructure: 'The screenshot does not provide enough clear evidence for a setup review.',
      observedFacts: [],
      missingInformation: [reason],
    },
    recommendations: [],
    setupGuide: {
      indicatorsToConsider: [],
      drawingToolsToConsider: [],
      settingsAndConfigurations: [],
      howToCombine: [],
      howToReadCombinedChart: [],
    },
    direction: {
      enoughInformation: false,
      verdict: 'INSUFFICIENT_DATA',
      confidence: Math.max(0, Math.min(15, Math.round(rawConfidence))),
      upEvidence: [],
      downEvidence: [],
      conflictingSignals: [],
      waitReason: reason,
      requestAnotherScreenshot: true,
    },
    bengaliLearning: {
      toolsToUse: ['প্রথমে একটির পর একট করে টুল যোগ করুন; একসাথে অনেক টুল লাগালে চার্ট জটিল হয়ে যায়।'],
      whyToolsHelp: ['আসল চার্টের দৃশ্যমান তথ্যের সাথে মিল রেখে শুধু প্রয়োজনীয় টুল বেছে নিলে পড়া সহজ হয়।'],
      howToConfigure: ['প্রতিটি টুলের সেটিংস কম রেখে শুরু করুন এবং চার্টে কেমন দেখায় তা আগে পর্যবেক্ষণ করুন।'],
      howToReadChart: ['দামের গতিপথ, আগের ঘেরা জায়গা ও একাধিক টুলের মিলিত ইঙ্গিত একসাথে দেখুন; কোনো একটি ইঙ্গিতকেই চূড়ান্ত ধরবেন না।'],
      upScenario: 'উপরের দিকে যাওয়ার ইঙ্গিত মানে শুধু একটি সম্ভাব্য পরিস্থিতি; এর মানে পরের মোমবাতি অবশ্যই উঠবে না।',
      downScenario: 'নিচের দিকে যাওয়ার ইঙ্গিতও শুধু একটি সম্ভাব্য পরিস্থিতি; এর মানে পরের মোমবাতি অবশ্যই নামবে না।',
      waitGuidance: 'তথ্য অস্পষ্ট বা সংকেত মিশ্র হলে WAIT বেছে নেওয়াই বুদ্ধিমানের কাজ; এখন কোনো নির্দিষ্ট দিক অনুমান করবেন না।',
    },
    model,
    timestamp: new Date().toISOString(),
    disclaimer,
  }
}

export function parseSmartChartSetupResponse(raw: string, model: string): SmartChartSetupAnalysis {
  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The vision model response was not a JSON object.')
  }

  const body = parsed as Record<string, unknown>
  if (typeof body.enoughEvidence !== 'boolean') {
    throw new Error('The vision model response had no valid evidence decision.')
  }

  const directionBody = asObject(body.direction)
  const confidence = Number(body.confidence ?? directionBody.confidence)
  if (!Number.isFinite(confidence)) {
    throw new Error('The vision model response had no valid confidence value.')
  }

  const summary = cleanText(body.summary)
  if (!summary) throw new Error('The vision model response had no summary.')

  const result: SmartChartSetupAnalysis = {
    enoughEvidence: body.enoughEvidence,
    summary,
    screenshot: parseScreenshot(body.screenshot),
    recommendations: parseRecommendations(body.recommendations),
    setupGuide: parseSetupGuide(body.setupGuide),
    direction: parseDirection(body.direction),
    bengaliLearning: parseBengaliLearning(body.bengaliLearning),
    model,
    timestamp: new Date().toISOString(),
    disclaimer,
  }

  if (hasUnsupportedClaims(collectResultText(result))) {
    throw new Error('The vision model used unsupported certainty language, so the result was rejected.')
  }
  validateLanguages(result)

  if (!body.enoughEvidence) {
    return insufficientResult(model, summary, confidence)
  }

  const hasSetupContent =
    result.screenshot.observedFacts.length > 0 &&
    result.recommendations.length > 0 &&
    result.setupGuide.settingsAndConfigurations.length > 0 &&
    result.bengaliLearning.upScenario.length > 0

  if (!hasSetupContent) {
    return insufficientResult(
      model,
      'The screenshot does not provide enough clear evidence to recommend a reliable chart setup.',
      confidence,
    )
  }

  return result
}
