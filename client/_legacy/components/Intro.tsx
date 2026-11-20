import { Activity, ArrowRight, ChartNoAxesCombined, Sparkles } from 'lucide-react'
import { useApp } from '../state'
import { Logo } from './Logo'

export function Intro() {
  const { start } = useApp()

  return (
    <div className="intro">
      <div className="intro-bg" aria-hidden="true">
        <span className="orb orb--blue" />
        <span className="orb orb--purple" />
        <span className="orb orb--cyan" />
        <div className="grid-plane" />
      </div>

      <header className="intro-top">
        <div className="brand-mini"><Logo size={38} animated={false} /><span>AG BOT</span></div>
        <span className="intro-version">AI TERMINAL · v1.0</span>
      </header>

      <main className="intro-main">
        <div className="intro-badge"><Sparkles size={13} /> ADVANCED AI TRADING ANALYSIS</div>
        <div className="intro-logo-wrap"><Logo size={136} /></div>
        <h1 className="intro-title">AG <span>BOT</span></h1>
        <p className="intro-sub">
          Real market data. Transparent technical analysis.
          <br /> A premium workspace for informed trading decisions.
        </p>

        <div className="intro-features">
          <div className="feature-chip"><Activity size={16} /> Live candle analysis</div>
          <div className="feature-chip"><ChartNoAxesCombined size={16} /> 9 technical factors</div>
          <div className="feature-chip"><Sparkles size={16} /> AI explanations</div>
        </div>

        <button type="button" className="btn-start" onClick={start}>
          <span>START</span>
          <ArrowRight size={22} />
        </button>

        <p className="intro-risk">
          Informational tool only · Not financial advice · No guaranteed profits · No automatic trades
        </p>
      </main>

      <footer className="intro-footer">
        <span>AG BOT © {new Date().getFullYear()}</span>
        <span>Market data via Twelve Data when configured</span>
      </footer>
    </div>
  )
}
