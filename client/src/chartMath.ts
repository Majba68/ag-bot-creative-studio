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

export function rsi(values: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1]
    gain += Math.max(change, 0)
    loss += Math.max(-change, 0)
  }
  let avgGain = gain / period
  let avgLoss = loss / period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

export function macdHistogram(values: number[], fast = 12, slow = 26, signalPeriod = 9): Array<number | null> {
  const fastLine = ema(values, fast)
  const slowLine = ema(values, slow)
  const line: Array<number | null> = values.map((_, index) =>
    index >= slow - 1 && fastLine[index] !== null && slowLine[index] !== null
      ? (fastLine[index] as number) - (slowLine[index] as number)
      : null,
  )
  const start = line.findIndex((value) => value !== null)
  const signal: Array<number | null> = Array(values.length).fill(null)
  if (start >= 0) {
    const valuesFromStart = ema(line.slice(start) as number[], signalPeriod)
    valuesFromStart.forEach((value, index) => { signal[start + index] = value })
  }
  return line.map((value, index) =>
    value !== null && signal[index] !== null ? value - (signal[index] as number) : null,
  )
}

export function bollinger(values: number[], period = 20, multiplier = 2) {
  const middle = sma(values, period)
  const upper: Array<number | null> = Array(values.length).fill(null)
  const lower: Array<number | null> = Array(values.length).fill(null)
  for (let i = period - 1; i < values.length; i += 1) {
    const window = values.slice(i - period + 1, i + 1)
    const mean = middle[i] as number
    const deviation = Math.sqrt(window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period)
    upper[i] = mean + multiplier * deviation
    lower[i] = mean - multiplier * deviation
  }
  return { upper, middle, lower }
}
