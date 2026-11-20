import { useEffect, useRef, useState } from 'react'
import {
  ColorType, CrosshairMode, LineStyle, createChart,
  type IChartApi, type ISeriesApi, type UTCTimestamp,
} from 'lightweight-charts'
import { ArrowDownRight, ArrowUpRight, Clock3, Maximize2, Radio, RefreshCw, WifiOff } from 'lucide-react'
import { useApp } from '../state'
import { bollinger, ema, sma } from '../chartMath'
import type { Candle, Interval } from '../types'
import { IndicatorPanes } from './IndicatorPanes'

const intervalMinutes: Record<Interval, number> = { '1min': 1, '5min': 5, '15min': 15, '30min': 30, '1h': 60 }

function countdown(interval: Interval) {
  const seconds = intervalMinutes[interval] * 60
  const remaining = seconds - Math.floor(Date.now() / 1000) % seconds
  return `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
}

const statusLabel = {
  live: 'FRESH DATA',
  delayed: 'DELAYED / STALE',
  unavailable: 'DATA UNAVAILABLE',
  error: 'PROVIDER ERROR',
  simulated: 'SIMULATED DEMO DATA',
}

const lineData = (candles: Candle[], values: Array<number | null>) =>
  candles
    .map((candle, index) => ({ time: candle.time as UTCTimestamp, value: values[index] }))
    .filter((point): point is { time: UTCTimestamp; value: number } => point.value !== null)

export function TvChart() {
  const { market, marketLoading, marketError, settings, runAnalysis, analyzing } = useApp()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<unknown[]>([])
  const viewKeyRef = useRef('')
  const visibleRangeRef = useRef<{ from: number; to: number } | null>(null)
  const [remaining, setRemaining] = useState(() => countdown(settings.interval))

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(countdown(settings.interval)), 1000)
    return () => window.clearInterval(timer)
  }, [settings.interval])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      width: Math.max(container.clientWidth, 320),
      height: Math.max(container.clientHeight, 320),
      layout: {
        background: { type: ColorType.Solid, color: '#0A0F1A' },
        textColor: '#8DA3C4',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.035)' },
        horzLines: { color: 'rgba(255,255,255,0.035)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(0,200,255,.45)', labelBackgroundColor: '#0E3550' },
        horzLine: { color: 'rgba(139,92,246,.45)', labelBackgroundColor: '#2C2060' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,.08)',
        scaleMargins: { top: 0.1, bottom: 0.12 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,.08)',
        timeVisible: true,
        secondsVisible: false,
      },
    })
    chartRef.current = chart

    const observer = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        chart.applyOptions({ width: container.clientWidth, height: container.clientHeight })
      }
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      seriesRef.current = []
      chart.remove()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const viewKey = `${settings.symbol}|${settings.interval}|${settings.chartType}`
    const sameView = viewKeyRef.current === viewKey
    if (sameView) {
      const range = chart.timeScale().getVisibleLogicalRange()
      if (range) visibleRangeRef.current = { from: range.from, to: range.to }
    }
    seriesRef.current.forEach((series) => chart.removeSeries(series as unknown as ISeriesApi<'Candlestick'>))
    seriesRef.current = []

    const candles = market?.candles ?? []
    if (!candles.length) {
      viewKeyRef.current = viewKey
      return
    }

    if (settings.chartType === 'candlestick') {
      const series = chart.addCandlestickSeries({
        upColor: '#16C784', downColor: '#F6465D', borderVisible: false,
        wickUpColor: '#16C784', wickDownColor: '#F6465D',
      })
      series.setData(candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open, high: candle.high, low: candle.low, close: candle.close,
      })))
      seriesRef.current.push(series)
    } else {
      const values = candles.map((candle) => candle.close)
      const series = settings.chartType === 'area'
        ? chart.addAreaSeries({
            lineColor: '#00C8FF', topColor: 'rgba(0,200,255,.32)', bottomColor: 'rgba(0,200,255,0)', lineWidth: 2,
          })
        : chart.addLineSeries({ color: '#00C8FF', lineWidth: 2 })
      series.setData(values.map((value, index) => ({ time: candles[index].time as UTCTimestamp, value })))
      seriesRef.current.push(series)
    }

    const closes = candles.map((candle) => candle.close)
    const addOverlay = (values: Array<number | null>, color: string, dashed = false) => {
      const series = chart.addLineSeries({
        color,
        lineWidth: 1,
        lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      series.setData(lineData(candles, values))
      seriesRef.current.push(series)
    }

    if (settings.indicators.includes('ema20')) addOverlay(ema(closes, 20), '#00C8FF')
    if (settings.indicators.includes('ema50')) addOverlay(ema(closes, 50), '#8B5CF6')
    if (settings.indicators.includes('sma200')) addOverlay(sma(closes, 200), '#F5B942')
    if (settings.indicators.includes('bollinger')) {
      const bands = bollinger(closes)
      addOverlay(bands.upper, 'rgba(139,92,246,.55)', true)
      addOverlay(bands.lower, 'rgba(139,92,246,.55)', true)
    }

    if (sameView && visibleRangeRef.current) {
      chart.timeScale().setVisibleLogicalRange(visibleRangeRef.current)
    } else {
      chart.timeScale().fitContent()
      visibleRangeRef.current = null
    }
    viewKeyRef.current = viewKey
  }, [market, settings.symbol, settings.interval, settings.chartType, settings.indicators])

  const candles = market?.candles ?? []
  const last = candles[candles.length - 1]
  const previous = candles[candles.length - 2]
  const change = last && previous ? last.close - previous.close : 0
  const changePercent = previous && previous.close !== 0 ? (change / previous.close) * 100 : 0
  const bullish = change >= 0
  const status = market?.status ?? (marketError ? 'error' : 'unavailable')
  const showEmpty = settings.marketType === 'otc' || candles.length === 0
  const minutesPerBar = intervalMinutes[settings.interval]
  const historyOptions = minutesPerBar >= 60
    ? [{ label: '1D', bars: 24 }, { label: '1W', bars: 168 }]
    : [
        { label: '1H', bars: Math.max(20, Math.round(60 / minutesPerBar)) },
        { label: '4H', bars: Math.max(20, Math.round(240 / minutesPerBar)) },
      ]
  const applyHistory = (bars: number) => {
    if (!candles.length) return
    const to = candles.length - 1
    chartRef.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, to - bars + 1), to })
  }

  return (
    <section className="panel tv-panel">
      <div className="tv-head">
        <div className="tv-title">
          <span
            className={`live-pill ${status}`}
            title={status === 'simulated'
              ? 'These candles are generated locally for demo testing. They are not real market prices.'
              : 'Freshness is estimated from the age of the last candle returned by the provider. Check your provider plan for real-time entitlements.'}
          >
            <Radio size={12} /> {statusLabel[status]}
          </span>
          <div>
            <h2>{settings.symbol}</h2>
            <p>{settings.interval} · {settings.marketType === 'otc' ? 'OTC / Synthetic' : 'Non-OTC spot'} · {market?.source ?? 'Awaiting provider'}</p>
          </div>
        </div>

        <div className="tv-stats">
          <div className="tv-price-block">
            <span className="tv-price">{last ? last.close.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 }) : '—'}</span>
            <span className={`tv-change ${bullish ? 'up' : 'down'}`}>
              {bullish ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {last ? `${change >= 0 ? '+' : ''}${changePercent.toFixed(3)}%` : '—'}
            </span>
          </div>
          <div className="tv-countdown"><Clock3 size={14} /><span>{remaining}</span><small>{status === 'simulated' ? 'next demo bar' : 'next candle'}</small></div>
          <button type="button" className="icon-btn" title="Reset chart view" onClick={() => chartRef.current?.timeScale().fitContent()}>
            <Maximize2 size={16} />
          </button>
          <button type="button" className="icon-btn" title="Refresh analysis" onClick={() => void runAnalysis()} disabled={analyzing}>
            <RefreshCw size={16} className={analyzing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="chart-shell">
        <div ref={containerRef} className="chart-canvas" />
        {marketLoading && <div className="chart-overlay"><span className="loader" /> Connecting to market data…</div>}
        {!marketLoading && showEmpty && (
          <div className="chart-overlay chart-overlay--empty">
            <WifiOff size={30} />
            <h3>{settings.marketType === 'otc' ? 'No live feed for this instrument' : 'No market data to display'}</h3>
            <p>
              {settings.marketType === 'otc'
                ? 'Broker-synthetic OTC quotes are generated by your broker. No independent real-time feed exists, so AG BOT will not display a price for it.'
                : market?.reason ?? marketError ?? 'Configure TWELVEDATA_API_KEY on the server to receive real candle data.'}
            </p>
          </div>
        )}
      </div>

      <IndicatorPanes candles={candles} />

      <div className="tv-foot">
        <div className="tv-foot-info">
          <span>{candles.length} {status === 'simulated' ? 'simulated candles' : 'real candles'} · {market?.lastUpdated ? `${status === 'simulated' ? 'demo bar' : 'last candle'} ${new Date(market.lastUpdated).toISOString().slice(11, 19)} UTC` : 'no timestamp'}</span>
          <span>Volume: {market?.volumeAvailable ? 'available' : 'unavailable from provider'}</span>
          <span>{status === 'simulated' ? 'SIMULATED prices — not real quotes and never a trade offer.' : 'Price shown is the provider’s last candle close, not a quote or a trade offer.'}</span>
        </div>
        {candles.length > 0 && (
          <div className="history-buttons" aria-label="Chart history range">
            {historyOptions.map((option) => (
              <button key={option.label} type="button" onClick={() => applyHistory(option.bars)}>{option.label}</button>
            ))}
            <button type="button" onClick={() => chartRef.current?.timeScale().fitContent()}>ALL</button>
          </div>
        )}
      </div>
    </section>
  )
}
