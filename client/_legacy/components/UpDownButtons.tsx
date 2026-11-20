import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react'
import { useApp } from '../state'

export function UpDownButtons() {
  const { analysis, analyzing, notify, health } = useApp()
  const simulated = analysis?.educationalDemo === true || analysis?.dataStatus === 'simulated' || health?.demoMode === true

  const handleClick = (direction: 'UP' | 'DOWN') => {
    const prefix = simulated ? 'SIMULATED DEMO — ' : ''
    notify(
      analysis
        ? `${prefix}${direction} selected visually. AG BOT is analysis-only — no trade was placed.`
        : `${prefix}${direction} is a display control only. Run an analysis first and open your broker to trade yourself.`,
      'info',
    )
  }

  return (
    <section className="updown-panel">
      <div className="updown-head">
        <span><Info size={14} /> {simulated ? 'Simulated result display · educational only' : 'AI result display · no automatic execution'}</span>
        <strong>{analysis ? `Current bias: ${analysis.signal}` : 'No analysis yet'}</strong>
      </div>
      <div className="updown-grid">
        <button
          type="button"
          className={`up-btn${analysis?.signal === 'UP' ? ' selected' : ''}`}
          onClick={() => handleClick('UP')}
          disabled={analyzing}
        >
          <ArrowUpRight size={30} />
          <span>UP 📈</span>
          <small>{analysis?.signal === 'UP'
            ? `${simulated ? 'Demo result' : 'AI result'} · ${analysis.confidence}% confidence`
            : 'Potential upward movement'}</small>
        </button>
        <button
          type="button"
          className={`down-btn${analysis?.signal === 'DOWN' ? ' selected' : ''}`}
          onClick={() => handleClick('DOWN')}
          disabled={analyzing}
        >
          <ArrowDownRight size={30} />
          <span>DOWN 📉</span>
          <small>{analysis?.signal === 'DOWN'
            ? `${simulated ? 'Demo result' : 'AI result'} · ${analysis.confidence}% confidence`
            : 'Potential downward movement'}</small>
        </button>
      </div>
      <p className="updown-note">
        These buttons only reflect the analysis result. They never place, modify or close trades on any platform.
      </p>
    </section>
  )
}
