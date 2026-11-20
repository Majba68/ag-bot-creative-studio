import { type CSSProperties } from 'react'
import { AlertTriangle, BrainCircuit, Clock3, Crosshair, Gauge, Layers, RefreshCw, ShieldAlert } from 'lucide-react'
import { useApp } from '../state'

export function AnalysisCard() {
  const { analysis, analyzing, analysisError, runAnalysis, settings, health } = useApp()
  const simulated = analysis?.educationalDemo === true || analysis?.dataStatus === 'simulated' || (!analysis && health?.demoMode === true)
  const digits = settings.symbol.includes('JPY') ? 3 : 5
  const fmt = (value: number | null | undefined) => value === null || value === undefined ? '—' : value.toFixed(digits)

  return (
    <section className="panel analysis-panel">
      <div className="panel-head analysis-head">
        <div>
          <h2><BrainCircuit size={17} /> AG BOT AI analysis</h2>
          <p>{simulated
            ? 'Technical assessment of SIMULATED data — not real market prices'
            : analysis?.dataStatus === 'unavailable' || analysis?.dataStatus === 'error' || (!analysis && health?.dataMode !== 'real')
              ? 'No real market data available — analysis stays on WAIT'
              : 'Technical assessment of real candle data'}</p>
        </div>
        <button type="button" className="btn-primary btn-small" onClick={() => void runAnalysis()} disabled={analyzing}>
          <RefreshCw size={15} className={analyzing ? 'spin' : ''} />
          {analyzing ? 'Analysing…' : analysis ? 'Re-run' : 'Run analysis'}
        </button>
      </div>

      {analysisError && <div className="inline-error"><AlertTriangle size={15} /> {analysisError}</div>}

      {!analysis ? (
        <div className="analysis-empty">
          <BrainCircuit size={34} />
          <h3>No analysis yet</h3>
          <p>
            Run the analysis engine to score candlestick patterns, support and resistance, trend, RSI, MACD,
            moving averages, volatility, volume (when available) and higher-timeframe confirmation.
          </p>
          <button type="button" className="btn-primary" onClick={() => void runAnalysis()} disabled={analyzing}>
            {analyzing ? 'Analysing…' : 'Run AI analysis'}
          </button>
          <small>Results are informational and never guarantee a winning trade.</small>
        </div>
      ) : (
        <>
          <div className={`verdict verdict--${analysis.signal.toLowerCase()}`}>
            <div
              className="confidence-ring"
              style={{ '--pct': `${analysis.confidence}%` } as CSSProperties}
            >
              <span>{analysis.confidence}<small>%</small></span>
            </div>
            <div className="verdict-copy">
              <span className="verdict-label">{simulated ? 'SIMULATED RESULT · EDUCATIONAL' : 'AI RESULT'}</span>
              {simulated && <span className="demo-badge">DEMO</span>}
              <strong>
                {analysis.signal === 'UP' ? 'UP 📈' : analysis.signal === 'DOWN' ? 'DOWN 📉' : 'WAIT ⏳'}
              </strong>
              <p>
                {analysis.signal === 'UP'
                  ? 'Potential upward movement'
                  : analysis.signal === 'DOWN'
                    ? 'Potential downward movement'
                    : 'No clear trading opportunity'}
              </p>
              <small>Confidence level · aggregate score {analysis.score}</small>
            </div>
          </div>

          <p className="analysis-explanation">{analysis.explanation}</p>

          <div className="analysis-grid">
            <div className="subcard">
              <h3><Crosshair size={14} /> Key levels</h3>
              <div className="level-rows">
                <div><span>Resistance</span><strong className="res">{analysis.resistance.map(fmt).join(' · ') || '—'}</strong></div>
                <div><span>Support</span><strong className="sup">{analysis.support.map(fmt).join(' · ') || '—'}</strong></div>
                <div><span>Price</span><strong>{fmt(analysis.metrics.price)}</strong></div>
              </div>
            </div>

            <div className="subcard">
              <h3><Gauge size={14} /> Indicator snapshot</h3>
              <div className="metric-rows">
                <div><span>RSI (14)</span><strong>{analysis.metrics.rsi ?? '—'}</strong></div>
                <div><span>MACD hist.</span><strong>{analysis.metrics.macdHistogram?.toFixed(5) ?? '—'}</strong></div>
                <div><span>EMA 20 / 50</span><strong>{fmt(analysis.metrics.ema20)} / {fmt(analysis.metrics.ema50)}</strong></div>
                <div><span>ATR volatility</span><strong>{analysis.metrics.atrPercent === null ? '—' : `${analysis.metrics.atrPercent.toFixed(3)}%`}</strong></div>
                <div><span>Volume</span><strong>{analysis.metrics.volumeAvailable ? 'available' : 'unavailable'}</strong></div>
              </div>
            </div>

            <div className="subcard subcard--wide">
              <h3><Layers size={14} /> Contributing factors</h3>
              <div className="factor-list">
                {analysis.factors.length === 0 && <span className="muted">Not enough signals to score.</span>}
                {analysis.factors.map((factor) => (
                  <div key={factor.label} className={`factor factor--${factor.direction.toLowerCase()}`}>
                    <span className="factor-badge">{factor.direction === 'UP' ? '+' : factor.direction === 'DOWN' ? '−' : '='}</span>
                    <div><strong>{factor.label}</strong><small>{factor.detail}</small></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="subcard subcard--wide">
              <h3><Clock3 size={14} /> Timeframe confirmation</h3>
              <div className="tf-row">
                {analysis.timeframeConfirmation.length === 0 && <span className="muted">No higher-timeframe data available.</span>}
                {analysis.timeframeConfirmation.map((item) => (
                  <span key={item.interval} className={`tf-chip ${item.direction.toLowerCase()}`}>
                    {item.interval} · {item.direction} <small>{item.detail}</small>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="risk-box"><ShieldAlert size={16} /><div><strong>Risk warning</strong><p>{analysis.riskWarning}</p></div></div>

          <div className="analysis-meta">
            <span>Updated {new Date(analysis.timestamp).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
            <span>Data: {analysis.dataStatus}</span>
            <span>Engine: {analysis.source === 'deterministic+llm' ? 'technical engine + AI wording' : 'technical engine'}</span>
            <span>{analysis.metrics.barsAnalyzed} bars analysed</span>
          </div>
          <p className="disclaimer-inline">{analysis.disclaimer}</p>
        </>
      )}
    </section>
  )
}
