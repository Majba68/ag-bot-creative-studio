import { BarChart3, CandlestickChart, LineChart, SlidersHorizontal } from 'lucide-react'
import { useApp } from '../state'
import type { Interval } from '../types'

const intervals: Array<{ value: Interval; label: string }> = [
  { value: '1min', label: '1M' },
  { value: '5min', label: '5M' },
  { value: '15min', label: '15M' },
  { value: '30min', label: '30M' },
  { value: '1h', label: '1H' },
]

const indicators = [
  { value: 'ema20', label: 'EMA 20' },
  { value: 'ema50', label: 'EMA 50' },
  { value: 'sma200', label: 'SMA 200' },
  { value: 'bollinger', label: 'Bollinger Bands' },
  { value: 'rsi', label: 'RSI (analysis)' },
  { value: 'macd', label: 'MACD (analysis)' },
]

export function SettingsPanel() {
  const { settings, updateSettings, market } = useApp()

  const toggleIndicator = (value: string) => {
    updateSettings({
      indicators: settings.indicators.includes(value)
        ? settings.indicators.filter((item) => item !== value)
        : [...settings.indicators, value],
    })
  }

  return (
    <section className="panel settings-panel">
      <div className="panel-head">
        <div>
          <h2><SlidersHorizontal size={16} /> Trading settings</h2>
          <p>Configure the analysis workspace</p>
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">Currency pair</label>
        <div className="selected-pair"><span className={`pair-dot ${settings.marketType}`} />{settings.symbol}</div>
      </div>

      <div className="field-group">
        <label className="field-label">Timeframe</label>
        <div className="chip-row">
          {intervals.map((item) => (
            <button
              type="button"
              key={item.value}
              className={`chip${settings.interval === item.value ? ' active' : ''}`}
              onClick={() => updateSettings({ interval: item.value })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label className="field-label" htmlFor="duration">Trade duration (display only)</label>
        <select
          id="duration"
          className="select-field"
          value={settings.duration}
          onChange={(event) => updateSettings({ duration: Number(event.target.value) })}
        >
          {[1, 3, 5, 10, 15, 30, 60].map((value) => (
            <option key={value} value={value}>{value} minute{value > 1 ? 's' : ''}</option>
          ))}
        </select>
        <small className="field-hint">AG BOT never places or times trades for you.</small>
      </div>

      <div className="field-group">
        <label className="field-label">Market type</label>
        <div className="market-type">
          <span className={settings.marketType === 'forex' ? 'on' : ''}>Non-OTC</span>
          <span className={settings.marketType === 'otc' ? 'on' : ''}>OTC</span>
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">Chart type</label>
        <div className="segmented">
          <button type="button" className={settings.chartType === 'candlestick' ? 'active' : ''} onClick={() => updateSettings({ chartType: 'candlestick' })}>
            <CandlestickChart size={15} /> Candles
          </button>
          <button type="button" className={settings.chartType === 'line' ? 'active' : ''} onClick={() => updateSettings({ chartType: 'line' })}>
            <LineChart size={15} /> Line
          </button>
          <button type="button" className={settings.chartType === 'area' ? 'active' : ''} onClick={() => updateSettings({ chartType: 'area' })}>
            <BarChart3 size={15} /> Area
          </button>
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">Technical indicators</label>
        <div className="indicator-grid">
          {indicators.map((item) => (
            <label key={item.value} className="check-row">
              <input
                type="checkbox"
                checked={settings.indicators.includes(item.value)}
                onChange={() => toggleIndicator(item.value)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <small className="field-hint">
          RSI &amp; MACD are computed on the backend and shown in the analysis panel.
          {market && !market.volumeAvailable ? ' Volume data is unavailable from the provider for this pair.' : ''}
        </small>
      </div>
    </section>
  )
}
