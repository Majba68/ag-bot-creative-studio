import { useState } from 'react'
import { Bot, CheckCircle2, ExternalLink, Info, Menu, Radio, Settings2, X } from 'lucide-react'
import { useApp } from '../state'
import { AnalysisCard } from './AnalysisCard'
import { AssistantChat } from './AssistantChat'
import { CurrencyPicker } from './CurrencyPicker'
import { Disclaimer } from './Disclaimer'
import { Logo } from './Logo'
import { PlatformModal } from './PlatformModal'
import { Robot } from './Robot'
import { SettingsPanel } from './SettingsPanel'
import { TvChart } from './TvChart'
import { UpDownButtons } from './UpDownButtons'

export function Dashboard() {
  const { health, goIntro, setAssistantOpen, setPlatformOpen, toast, settings, market } = useApp()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="dashboard">
      <div className="dashboard-bg" aria-hidden="true"><span /><span /></div>

      <header className="topbar">
        <button type="button" className="brand" onClick={goIntro} title="Back to intro">
          <Logo size={36} animated={false} />
          <span className="brand-text"><strong>AG BOT</strong><small>AI TRADING TERMINAL</small></span>
        </button>

        <div className="topbar-status">
          <span className={`status-chip ${health?.dataMode === 'real' ? 'on' : health?.dataMode === 'simulated' ? 'sim' : 'off'}`}>
            <Radio size={12} /> {health?.dataMode === 'simulated'
              ? 'Simulated data'
              : health?.dataMode === 'real'
                ? 'Real data · Twelve Data'
                : 'No market data'}
          </span>
          <span className={`status-chip ${health?.llmConfigured ? 'on' : 'off'}`}>
            <Bot size={12} /> AI service {health?.llmConfigured ? 'connected' : 'not configured'}
          </span>
        </div>

        <nav className="topbar-actions">
          <button type="button" className="ghost-btn mobile-only" aria-label="Toggle panels" onClick={() => setSidebarOpen((value) => !value)}>
            {sidebarOpen ? <X size={17} /> : <Menu size={17} />} <span>Panels</span>
          </button>
          <button type="button" className="ghost-btn" aria-label="Open assistant" onClick={() => setAssistantOpen(true)}>
            <Bot size={17} /> <span>Assistant</span>
          </button>
          <button type="button" className="ghost-btn accent" aria-label="Open trading platform" onClick={() => setPlatformOpen(true)}>
            <ExternalLink size={16} /> <span>Platform</span>
          </button>
        </nav>
      </header>

      <div className="workspace">
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="sidebar-title"><Settings2 size={15} /> Workspace controls</div>
          <SettingsPanel />
          <CurrencyPicker onSelect={() => setSidebarOpen(false)} />
        </aside>

        <main className="main-column" onClick={() => sidebarOpen && setSidebarOpen(false)}>
          <div className="main-heading">
            <div>
              <span className="eyebrow">
                {health?.dataMode === 'simulated'
                  ? 'SIMULATED DEMO WORKSPACE'
                  : health?.dataMode === 'real'
                    ? 'LIVE ANALYSIS WORKSPACE'
                    : 'ANALYSIS WORKSPACE'}
              </span>
              <h1>{settings.symbol} <em>· {settings.interval}</em></h1>
              <p>Market: {settings.marketType === 'otc' ? 'OTC / Synthetic (no independent feed)' : 'Non-OTC spot'} · Data: {market?.status ?? 'connecting'}</p>
            </div>
            <button type="button" className="btn-primary hide-desktop" onClick={() => setAssistantOpen(true)}>
              <Bot size={16} /> Ask AI
            </button>
          </div>

          {health?.demoMode && (
            <div className="setup-banner demo" role="status">
              <Info size={16} />
              <span>DEMO MODE IS ON — every price, indicator and UP/DOWN verdict below is generated locally for educational interface testing. These are NOT real market prices and must never be used for trading decisions.</span>
            </div>
          )}
          {health && !health.demoMode && (!health.marketDataConfigured || !health.llmConfigured) && (
            <div className="setup-banner" role="status">
              <Info size={16} />
              <span>
                {!health.marketDataConfigured
                  ? 'No market-data key configured — charts show an empty state, never invented prices.'
                  : 'Market data is connected. Add an LLM key to enable AI wording, chat and screenshot analysis.'}
                {!health.marketDataConfigured && !health.llmConfigured ? ' Add keys to server/.env, then restart.' : ''}
              </span>
            </div>
          )}

          <section className="robot-hero">
            <div className="robot-hero-glow" />
            <div className="robot-hero-center">
              <Robot onClick={() => setAssistantOpen(true)} compact />
            </div>
            <div className="robot-hero-copy">
              <span className="eyebrow">AG BOT AI CORE</span>
              <strong>{health?.dataMode === 'simulated' ? 'Demo mode is active' : 'Your AI trading companion is online'}</strong>
              <p>{health?.dataMode === 'simulated'
                ? 'Explore simulated UP/DOWN analysis safely. No value here comes from a live market.'
                : 'Click the robot to ask questions, review the analysis, or inspect a chart screenshot.'}</p>
            </div>
            <button type="button" className="btn-primary btn-small robot-hero-btn" onClick={() => setAssistantOpen(true)}>
              <Bot size={15} /> Open assistant
            </button>
          </section>

          <TvChart />
          <AnalysisCard />
          <UpDownButtons />
          <Disclaimer />
        </main>
      </div>

      <AssistantChat />
      <PlatformModal />

      {toast && (
        <div className={`toast toast--${toast.kind}`} key={toast.id}>
          {toast.kind === 'success' ? <CheckCircle2 size={17} /> : <Radio size={17} />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  )
}
