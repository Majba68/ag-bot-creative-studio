import { useApp } from '../state'
import { macdHistogram, rsi } from '../chartMath'
import type { Candle } from '../types'

function makePath(values: Array<number | null>, min: number, max: number, width: number, height: number) {
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => point.value !== null)
  if (points.length < 2) return ''
  const range = max - min || 1
  const step = width / Math.max(values.length - 1, 1)
  return points
    .map((point, i) => {
      const x = point.index * step
      const y = height - ((point.value - min) / range) * height
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function Sparkline({
  values, min, max, color, referenceLines,
}: {
  values: Array<number | null>
  min: number
  max: number
  color: string
  referenceLines: Array<{ value: number; label: string }>
}) {
  const width = 600
  const height = 68
  const path = makePath(values, min, max, width, height)
  return (
    <div className="sparkline">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Indicator chart">
        {referenceLines.map((line) => {
          const y = height - ((line.value - min) / (max - min || 1)) * height
          return (
            <g key={line.label}>
              <line x1="0" x2={width} y1={y} y2={y} stroke="rgba(255,255,255,.14)" strokeDasharray="4 6" />
              <text x="4" y={Math.max(9, y - 3)} fill="rgba(180,200,230,.55)" fontSize="8">{line.label}</text>
            </g>
          )
        })}
        {path && <path d={path} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  )
}

export function IndicatorPanes({ candles }: { candles: Candle[] }) {
  const { settings } = useApp()
  const showRsi = settings.indicators.includes('rsi')
  const showMacd = settings.indicators.includes('macd')
  if ((!showRsi && !showMacd) || candles.length < 5) return null

  const closes = candles.map((candle) => candle.close)
  const rsiValues = rsi(closes)
  const macdValues = macdHistogram(closes)
  const latestRsi = [...rsiValues].reverse().find((value) => value !== null)
  const latestMacd = [...macdValues].reverse().find((value) => value !== null)
  const macdBound = Math.max(0.0001, ...macdValues.filter((value): value is number => value !== null).map(Math.abs)) * 1.15

  return (
    <div className="indicator-panes">
      {showRsi && (
        <div className="indicator-pane">
          <div className="indicator-head">
            <strong>RSI (14)</strong>
            <span className={latestRsi !== undefined && latestRsi > 70 ? 'hot' : latestRsi !== undefined && latestRsi < 30 ? 'cold' : ''}>
              {latestRsi === undefined ? '—' : latestRsi.toFixed(1)}
            </span>
          </div>
          <Sparkline values={rsiValues} min={0} max={100} color="#00C8FF" referenceLines={[{ value: 70, label: '70' }, { value: 30, label: '30' }]} />
        </div>
      )}
      {showMacd && (
        <div className="indicator-pane">
          <div className="indicator-head">
            <strong>MACD histogram (12,26,9)</strong>
            <span className={latestMacd !== undefined && latestMacd >= 0 ? 'cold' : 'hot'}>
              {latestMacd === undefined ? '—' : latestMacd.toFixed(5)}
            </span>
          </div>
          <Sparkline values={macdValues} min={-macdBound} max={macdBound} color="#8B5CF6" referenceLines={[{ value: 0, label: '0' }]} />
        </div>
      )}
    </div>
  )
}
