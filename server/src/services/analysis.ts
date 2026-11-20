import type { Analysis, DataStatus, Factor, Interval, MarketPayload } from '../types.js'
import { askLlm, safeText } from './llm.js'
import { hasLlm } from '../config.js'
import {
  atr, bollinger, detectPatterns, ema, latest, linearSlopePercent, macd,
  pivotLevels, rsi, sma,
} from './indicators.js'

const DISCLAIMER =
  'AG BOT analysis is informational only, is not financial advice, and does not guarantee profitable trades or any specific price movement.'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const bias = (score: number): Factor['direction'] => (score > 0.05 ? 'UP' : score < -0.05 ? 'DOWN' : 'NEUTRAL')

function emptyAnalysis(status: DataStatus, reason: string): Analysis {
  return {
    signal: 'WAIT',
    confidence: 0,
    score: 0,
    explanation: reason,
    factors: [],
    support: [],
    resistance: [],
    riskWarning: 'No reliable signal can be produced without sufficient real market data.',
    timestamp: new Date().toISOString(),
    dataStatus: status,
    source: 'deterministic',
    educationalDemo: status === 'simulated',
    metrics: {
      price: null, rsi: null, macd: null, macdSignal: null, macdHistogram: null,
      ema20: null, ema50: null, sma200: null, atrPercent: null,
      trendSlopePercent: null, volumeAvailable: false, barsAnalyzed: 0,
    },
    timeframeConfirmation: [],
    disclaimer: DISCLAIMER,
  }
}

export async function analyze(
  primary: MarketPayload,
  higherTimeframes: MarketPayload[] = [],
): Promise<Analysis> {
  if (primary.status === 'unavailable' || primary.status === 'error') {
    return emptyAnalysis(
      primary.status,
      primary.reason ?? 'Real market data is unavailable, so no analysis can be produced.',
    )
  }

  if (primary.candles.length < 30) {
    return emptyAnalysis(
      primary.status,
      'At least 30 real candles are required before a technical assessment is meaningful. The AI result stays on WAIT until enough data is available.',
    )
  }

  const candles = primary.candles
  const closes = candles.map((candle) => candle.close)
  const price = closes[closes.length - 1]

  const ema20 = latest(ema(closes, 20))
  const ema50 = latest(ema(closes, 50))
  const sma200 = latest(sma(closes, 200))
  const rsiValue = latest(rsi(closes, 14))
  const macdSeries = macd(closes)
  const macdValue = latest(macdSeries.line)
  const macdSignal = latest(macdSeries.signal)
  const histogram = latest(macdSeries.histogram)
  const previousHistogram = [...macdSeries.histogram].reverse().find((value, index) => index > 0 && value !== null) ?? null
  const atrValue = latest(atr(candles, 14))
  const bb = bollinger(closes, 20, 2)
  const bbUpper = latest(bb.upper)
  const bbLower = latest(bb.lower)
  const bbMiddle = latest(bb.middle)
  const slope = linearSlopePercent(closes, 30)
  const patterns = detectPatterns(candles)
  const levels = pivotLevels(candles)
  const atrPercent = atrValue !== null && price ? (atrValue / price) * 100 : null
  const bollingerWidth = bbUpper !== null && bbLower !== null && bbMiddle ? ((bbUpper - bbLower) / bbMiddle) * 100 : null

  const factors: Factor[] = []
  const add = (label: string, score: number, weight: number, detail: string) => {
    factors.push({ label, score: clamp(score, -1, 1), weight, detail, direction: bias(score) })
  }

  if (ema20 !== null && ema50 !== null) {
    if (price > ema20 && ema20 > ema50) add('EMA structure', 1, 1.5, 'Price is above EMA20 and EMA20 is above EMA50 — short-term structure is upward.')
    else if (price < ema20 && ema20 < ema50) add('EMA structure', -1, 1.5, 'Price is below EMA20 and EMA20 is below EMA50 — short-term structure is downward.')
    else if (price > ema50) add('EMA structure', 0.35, 1.5, 'Price is holding above EMA50, but the shorter EMA alignment is mixed.')
    else add('EMA structure', -0.35, 1.5, 'Price is below EMA50, but the shorter EMA alignment is mixed.')
  }

  if (histogram !== null && macdValue !== null) {
    if (previousHistogram !== null && histogram > 0 && previousHistogram <= 0) add('MACD', 1, 1.2, 'MACD has crossed above its signal line — momentum is turning up.')
    else if (previousHistogram !== null && histogram < 0 && previousHistogram >= 0) add('MACD', -1, 1.2, 'MACD has crossed below its signal line — momentum is turning down.')
    else if (histogram > 0) add('MACD', 0.5, 1.2, 'MACD is above its signal line — momentum currently favours buyers.')
    else if (histogram < 0) add('MACD', -0.5, 1.2, 'MACD is below its signal line — momentum currently favours sellers.')
  }
  void macdSignal

  if (rsiValue !== null) {
    if (rsiValue < 30) add('RSI (14)', 0.7, 1.0, `RSI is ${rsiValue.toFixed(1)} — oversold territory can precede a bounce, but trends can stay oversold.`)
    else if (rsiValue > 70) add('RSI (14)', -0.7, 1.0, `RSI is ${rsiValue.toFixed(1)} — overbought territory can precede a pullback.`)
    else if (Math.abs(rsiValue - 50) > 5) add('RSI (14)', ((rsiValue - 50) / 25) * 0.55, 1.0, `RSI is ${rsiValue.toFixed(1)} — momentum is mildly ${rsiValue > 50 ? 'positive' : 'negative'}.`)
    else add('RSI (14)', 0, 1.0, 'RSI is near 50 — momentum is balanced.')
  }

  if (patterns.length) {
    const primaryPattern = patterns[0]
    const score = primaryPattern.bias === 'BULL' ? 0.8 : primaryPattern.bias === 'BEAR' ? -0.8 : 0
    add('Candlestick pattern', score, 0.9, `${primaryPattern.name}: ${primaryPattern.detail}`)
  }

  if (slope !== null) {
    const score = clamp(slope * 12, -0.9, 0.9)
    add('Trend slope', score, 1.1, `Recent regression slope is ${slope > 0 ? 'positive' : 'negative'} at ${slope.toFixed(3)}% per candle.`)
  }

  const nearestSupport = levels.support[0]
  const nearestResistance = levels.resistance[0]
  if (nearestResistance && nearestSupport) {
    if (price > nearestResistance * 1.002) add('Price action', 0.7, 0.9, 'Price has moved above the nearest mapped resistance — a potential breakout.')
    else if (price < nearestSupport * 0.998) add('Price action', -0.7, 0.9, 'Price has moved below the nearest mapped support — a potential breakdown.')
    else if (Math.abs(price - nearestResistance) / price < 0.0015) add('Price action', -0.4, 0.9, 'Price is testing nearby resistance — rejection is possible.')
    else if (Math.abs(price - nearestSupport) / price < 0.0015) add('Price action', 0.4, 0.9, 'Price is testing nearby support — a reaction is possible.')
    else add('Price action', 0, 0.9, 'Price is between the nearest support and resistance levels.')
  }

  if (sma200 !== null) {
    add('Long-term average', price > sma200 ? 0.5 : -0.5, 0.6, `Price is ${price > sma200 ? 'above' : 'below'} SMA200 — the broader bias is ${price > sma200 ? 'constructive' : 'weak'}.`)
  }

  const volumeAvailable = candles.slice(-10).every((candle) => candle.volume !== undefined && candle.volume > 0)
  if (volumeAvailable) {
    const recent = candles.slice(-5).reduce((sum, candle) => sum + (candle.volume ?? 0), 0) / 5
    const older = candles.slice(-10, -5).reduce((sum, candle) => sum + (candle.volume ?? 0), 0) / 5
    const rising = recent > older
    const bullishLast = candles[candles.length - 1].close >= candles[candles.length - 1].open
    add('Volume', rising ? (bullishLast ? 0.6 : -0.6) : 0, 0.6, rising ? 'Volume is rising versus the prior five candles.' : 'Volume is not confirming a strong move.')
  }

  const timeframeConfirmation: Analysis['timeframeConfirmation'] = []
  const higherScores: number[] = []
  for (const payload of higherTimeframes) {
    if (payload.candles.length < 30) continue
    const values = payload.candles.map((candle) => candle.close)
    const fast = latest(ema(values, 20))
    const slow = latest(ema(values, 50))
    if (fast === null || slow === null) continue
    const direction = fast > slow ? 'UP' : fast < slow ? 'DOWN' : 'NEUTRAL'
    higherScores.push(direction === 'UP' ? 1 : direction === 'DOWN' ? -1 : 0)
    timeframeConfirmation.push({
      interval: payload.interval as Interval,
      direction,
      detail: `EMA20 is ${direction === 'UP' ? 'above' : 'below'} EMA50 on ${payload.interval}.`,
    })
  }
  if (higherScores.length) {
    const average = higherScores.reduce((a, b) => a + b, 0) / higherScores.length
    add('Multi-timeframe', average, 1.1, `Higher timeframes are ${average > 0.3 ? 'aligned upward' : average < -0.3 ? 'aligned downward' : 'mixed'}.`)
  }

  const active = factors.filter((factor) => factor.weight > 0 && factor.score !== 0)
  const totalWeight = active.reduce((sum, factor) => sum + factor.weight, 0)
  const score = totalWeight > 0
    ? active.reduce((sum, factor) => sum + factor.score * factor.weight, 0) / totalWeight
    : 0
  const agreement = active.length
    ? active.filter((factor) => Math.sign(factor.score) === Math.sign(score || 1)).length / active.length
    : 0

  let confidence = Math.round(clamp(38 + Math.abs(score) * 46 + agreement * 17, 30, 94))
  if (atrPercent !== null && atrPercent > 0.8) confidence -= 6
  if (bollingerWidth !== null && bollingerWidth > 1.2) confidence -= 4
  if (primary.status !== 'live') confidence -= 6
  confidence = Math.round(clamp(confidence, 25, 94))

  let signal: Analysis['signal'] = Math.abs(score) < 0.2 ? 'WAIT' : score > 0 ? 'UP' : 'DOWN'
  let effectiveScore = score
  let demoFallback = false

  // Educational demo only: guarantee a visible UP/DOWN example from the locally
  // generated trend. Real-data analysis is never forced away from WAIT.
  if (primary.status === 'simulated' && signal === 'WAIT') {
    signal = closes[closes.length - 1] >= closes[0] ? 'UP' : 'DOWN'
    effectiveScore = signal === 'UP' ? 0.2 : -0.2
    demoFallback = true
  }

  const topFactors = [...active]
    .sort((a, b) => Math.abs(b.score * b.weight) - Math.abs(a.score * a.weight))
    .slice(0, 3)
  const deterministicExplanation =
    (primary.status === 'simulated' ? 'EDUCATIONAL DEMO ANALYSIS — generated from simulated candles, not real market prices. ' : '') +
    `Across ${active.length} technical factors on ${primary.interval}, the strongest signals are: ${topFactors.map((factor) => factor.detail).join(' ')} ` +
    `Nearest support is ${levels.support[0]?.toFixed(5) ?? 'not identified'} and nearest resistance is ${levels.resistance[0]?.toFixed(5) ?? 'not identified'}. ` +
    `The aggregate score of ${effectiveScore.toFixed(2)} maps to ${signal === 'WAIT' ? 'no clear setup' : `a potential ${signal} bias`}; outcomes remain uncertain.` +
    (demoFallback ? ' This UP/DOWN example was derived from the simulated trend for demonstration only.' : '')

  const riskWarning =
    (primary.status === 'simulated' ? 'SIMULATED DEMO DATA — these numbers are generated locally and are not real market prices. ' : '') +
    `Market conditions can change quickly. ATR-based volatility is ${atrPercent === null ? 'unavailable' : `${atrPercent.toFixed(3)}%`}` +
    `${bollingerWidth === null ? '' : ` and Bollinger width is ${bollingerWidth.toFixed(3)}%`}. ` +
    'News events and thin liquidity can invalidate technical signals. Manage risk with stops and position sizing.'

  const analysis: Analysis = {
    signal,
    confidence,
    score: Number(effectiveScore.toFixed(3)),
    explanation: deterministicExplanation,
    factors,
    support: levels.support,
    resistance: levels.resistance,
    riskWarning,
    timestamp: new Date().toISOString(),
    dataStatus: primary.status,
    source: 'deterministic',
    educationalDemo: primary.status === 'simulated',
    metrics: {
      price,
      rsi: rsiValue === null ? null : Number(rsiValue.toFixed(2)),
      macd: macdValue,
      macdSignal,
      macdHistogram: histogram,
      ema20,
      ema50,
      sma200,
      atrPercent: atrPercent === null ? null : Number(atrPercent.toFixed(4)),
      trendSlopePercent: slope,
      volumeAvailable,
      barsAnalyzed: candles.length,
    },
    timeframeConfirmation,
    disclaimer: DISCLAIMER,
  }

  if (hasLlm()) {
    const facts = [
      `Result: ${signal}`,
      `Confidence: ${confidence}%`,
      `Aggregate score: ${effectiveScore.toFixed(2)} (range -1 to +1)`,
      `Timeframe: ${primary.interval}`,
      `Data status: ${primary.status}`,
      ...topFactors.map((factor) => `${factor.label}: ${factor.detail}`),
      `Support: ${levels.support.join(', ')}`,
      `Resistance: ${levels.resistance.join(', ')}`,
    ].join('\n')

    const result = await askLlm({
      system:
        'You are a careful trading-analysis writer. Rewrite supplied technical facts into two or three plain sentences. ' +
        'Use only the supplied facts. Do not add prices, numbers, targets or predictions. Do not claim certainty, guarantees, or profitable outcomes. ' +
        'Use words such as "potential", "suggests" and "may".',
      prompt: `Technical facts:\n${facts}\n\nRewrite the facts as a short neutral explanation.`,
    })
    if (result.configured && result.text) {
      analysis.explanation = safeText(result.text, deterministicExplanation)
      analysis.source = 'deterministic+llm'
    }
  }

  return analysis
}
