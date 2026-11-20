import type { Candle } from '../types.js'

export const round = (value: number, digits = 4) => Number(value.toFixed(digits))

export function latest<T>(values: Array<T | null>): T | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] !== null) return values[i] as T
  }
  return null
}

export function sma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = []
  let sum = 0
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

export function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = []
  const multiplier = 2 / (period + 1)
  let previous: number | undefined

  for (let i = 0; i < values.length; i += 1) {
    if (i === period - 1) {
      let sum = 0
      for (let j = 0; j < period; j += 1) sum += values[j]
      previous = sum / period
      out.push(previous)
    } else if (i >= period && previous !== undefined) {
      previous = values[i] * multiplier + previous * (1 - multiplier)
      out.push(previous)
    } else {
      out.push(null)
    }
  }
  return out
}

export function rsi(closes: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = Array(closes.length).fill(null)
  if (closes.length <= period) return out

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i += 1) {
    const change = closes[i] - closes[i - 1]
    avgGain += Math.max(change, 0)
    avgLoss += Math.max(-change, 0)
  }
  avgGain /= period
  avgLoss /= period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const fastLine = ema(closes, fast)
  const slowLine = ema(closes, slow)
  const line: Array<number | null> = closes.map((_, i) =>
    i >= slow - 1 && fastLine[i] !== null && slowLine[i] !== null
      ? (fastLine[i] as number) - (slowLine[i] as number)
      : null,
  )

  const signal: Array<number | null> = Array(closes.length).fill(null)
  const start = line.findIndex((value) => value !== null)
  if (start >= 0) {
    const valid = line.slice(start) as number[]
    const signalValues = ema(valid, signalPeriod)
    signalValues.forEach((value, i) => {
      signal[start + i] = value
    })
  }

  const histogram: Array<number | null> = line.map((value, i) =>
    value !== null && signal[i] !== null ? value - (signal[i] as number) : null,
  )

  return { line, signal, histogram }
}

export function atr(candles: Candle[], period = 14): Array<number | null> {
  const out: Array<number | null> = Array(candles.length).fill(null)
  if (candles.length <= period) return out

  const tr: number[] = candles.map((candle, i) => {
    if (i === 0) return candle.high - candle.low
    const previousClose = candles[i - 1].close
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    )
  })

  let sum = 0
  for (let i = 0; i < period; i += 1) sum += tr[i]
  let value = sum / period
  out[period] = value
  for (let i = period + 1; i < candles.length; i += 1) {
    value = (value * (period - 1) + tr[i]) / period
    out[i] = value
  }
  return out
}

export function bollinger(closes: number[], period = 20, multiplier = 2) {
  const middle = sma(closes, period)
  const upper: Array<number | null> = Array(closes.length).fill(null)
  const lower: Array<number | null> = Array(closes.length).fill(null)

  for (let i = period - 1; i < closes.length; i += 1) {
    const window = closes.slice(i - period + 1, i + 1)
    const mean = middle[i] as number
    const variance = window.reduce((total, value) => total + (value - mean) ** 2, 0) / period
    const deviation = Math.sqrt(variance)
    upper[i] = mean + multiplier * deviation
    lower[i] = mean - multiplier * deviation
  }
  return { middle, upper, lower }
}

/** Normalised least-squares slope: percent change per bar relative to current price. */
export function linearSlopePercent(values: number[], period = 20): number | null {
  const series = values.slice(-period)
  if (series.length < 5) return null
  const n = series.length
  const meanX = (n - 1) / 2
  const meanY = series.reduce((a, b) => a + b, 0) / n
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i += 1) {
    numerator += (i - meanX) * (series[i] - meanY)
    denominator += (i - meanX) ** 2
  }
  if (denominator === 0 || meanY === 0) return null
  return ((numerator / denominator) / meanY) * 100
}

export function pivotLevels(candles: Candle[], tolerancePercent = 0.12) {
  const price = candles[candles.length - 1]?.close ?? 0
  if (!price) return { support: [] as number[], resistance: [] as number[] }

  const lookback = 3
  const swingHighs: number[] = []
  const swingLows: number[] = []
  for (let i = lookback; i < candles.length - lookback; i += 1) {
    const window = candles.slice(i - lookback, i + lookback + 1)
    if (candles[i].high === Math.max(...window.map((c) => c.high))) swingHighs.push(candles[i].high)
    if (candles[i].low === Math.min(...window.map((c) => c.low))) swingLows.push(candles[i].low)
  }

  const cluster = (values: number[]) => {
    const tolerance = (price * tolerancePercent) / 100
    const groups: number[][] = []
    for (const value of [...values].sort((a, b) => a - b)) {
      const group = groups.find((entry) => Math.abs(entry[0] - value) <= tolerance)
      if (group) group.push(value)
      else groups.push([value])
    }
    return groups
      .sort((a, b) => b.length - a.length)
      .map((group) => group.reduce((a, b) => a + b, 0) / group.length)
  }

  const recent = candles.slice(-30)
  const support = cluster(swingLows)
    .filter((level) => level < price * 0.999)
    .slice(0, 3)
  const resistance = cluster(swingHighs)
    .filter((level) => level > price * 1.001)
    .slice(0, 3)

  if (support.length === 0) support.push(Math.min(...recent.map((c) => c.low)))
  if (resistance.length === 0) resistance.push(Math.max(...recent.map((c) => c.high)))

  return {
    support: support.sort((a, b) => b - a).map((level) => round(level, 5)),
    resistance: resistance.sort((a, b) => a - b).map((level) => round(level, 5)),
  }
}

export function detectPatterns(candles: Candle[]) {
  const patterns: Array<{ name: string; bias: 'BULL' | 'BEAR' | 'NEUTRAL'; detail: string }> = []
  if (candles.length < 2) return patterns

  const current = candles[candles.length - 1]
  const previous = candles[candles.length - 2]
  const range = current.high - current.low
  if (range <= 0) return patterns

  const body = Math.abs(current.close - current.open)
  const upperWick = current.high - Math.max(current.open, current.close)
  const lowerWick = Math.min(current.open, current.close) - current.low
  const bullish = current.close >= current.open

  if (body / range < 0.1) {
    patterns.push({ name: 'Doji', bias: 'NEUTRAL', detail: 'Indecision candle — buyers and sellers are balanced.' })
  } else if (lowerWick >= body * 2 && upperWick <= body * 0.6) {
    patterns.push({ name: 'Hammer', bias: 'BULL', detail: 'Lower-wick rejection suggests buying interest at lower prices.' })
  } else if (upperWick >= body * 2 && lowerWick <= body * 0.6) {
    patterns.push({ name: 'Shooting Star', bias: 'BEAR', detail: 'Upper-wick rejection suggests selling pressure at higher prices.' })
  }

  const previousBody = Math.abs(previous.close - previous.open)
  if (bullish && previous.close < previous.open && body > previousBody && current.open <= previous.close && current.close >= previous.open) {
    patterns.push({ name: 'Bullish Engulfing', bias: 'BULL', detail: 'Bullish candle fully covers the prior bearish candle.' })
  } else if (!bullish && previous.open < previous.close && body > previousBody && current.open >= previous.close && current.close <= previous.open) {
    patterns.push({ name: 'Bearish Engulfing', bias: 'BEAR', detail: 'Bearish candle fully covers the prior bullish candle.' })
  }

  if (candles.length >= 3) {
    const first = candles[candles.length - 3]
    if (first.close < first.open && Math.abs(first.close - first.open) > previousBody && previous.close >= first.open && previous.close <= first.close && bullish) {
      patterns.push({ name: 'Morning Star (approx.)', bias: 'BULL', detail: 'Three-candle reversal shape after a decline.' })
    }
  }

  return patterns.slice(0, 2)
}
