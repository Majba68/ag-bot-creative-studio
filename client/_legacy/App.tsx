import { Crosshair, LayoutDashboard, ScanEye, SlidersHorizontal, Sparkles, TrendingUp } from 'lucide-react'
import { AgCreativeStudio } from './components/AgCreativeStudio'
import { Dashboard } from './components/Dashboard'
import { DirectionPro } from './components/DirectionPro'
import { FireLiveCenter, FireTabIcon } from './components/FireLiveCenter'
import { HorrorTabIcon, HorrorVisionTracking } from './components/HorrorVisionTracking'
import { Intro } from './components/Intro'
import { SmartChartSetupAnalyzer } from './components/SmartChartSetupAnalyzer'
import { SupportResistanceAnalyzer } from './components/SupportResistanceAnalyzer'
import { VisionAnalyzer } from './components/VisionAnalyzer'
import { useApp } from './state'

export default function App() {
  const { view, activeTab, setActiveTab } = useApp()

  if (view === 'intro') return <Intro />

  return (
    <div className="app-with-tabs">
      <nav className="main-tabs" aria-label="Main navigation">
        <div className="main-tabs-inner">
          <button
            type="button"
            className={`main-tab${activeTab === 'dashboard' ? ' active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          >
            <LayoutDashboard size={16} />
            <span>Trading Dashboard</span>
          </button>
          <button
            type="button"
            className={`main-tab vision${activeTab === 'vision' ? ' active' : ''}`}
            onClick={() => setActiveTab('vision')}
            aria-current={activeTab === 'vision' ? 'page' : undefined}
          >
            <ScanEye size={16} />
            <span>AG AI VISION ANALYZER</span>
          </button>
          <button
            type="button"
            className={`main-tab support-resistance${activeTab === 'support-resistance' ? ' active' : ''}`}
            onClick={() => setActiveTab('support-resistance')}
            aria-current={activeTab === 'support-resistance' ? 'page' : undefined}
          >
            <TrendingUp size={16} />
            <span>AG AI SUPPORT &amp; RESISTANCE ANALYZER</span>
          </button>
          <button
            type="button"
            className={`main-tab smart-chart${activeTab === 'smart-chart-setup' ? ' active' : ''}`}
            onClick={() => setActiveTab('smart-chart-setup')}
            aria-current={activeTab === 'smart-chart-setup' ? 'page' : undefined}
          >
            <SlidersHorizontal size={16} />
            <span>AG AI SMART CHART SETUP ANALYZER</span>
          </button>
          <button
            type="button"
            className={`main-tab direction-pro${activeTab === 'direction-pro' ? ' active' : ''}`}
            onClick={() => setActiveTab('direction-pro')}
            aria-current={activeTab === 'direction-pro' ? 'page' : undefined}
          >
            <Crosshair size={16} />
            <span>AG AI SMART DIRECTION PRO</span>
          </button>
          <button
            type="button"
            className={`main-tab fire-live-center${activeTab === 'fire-live-center' ? ' active' : ''}`}
            onClick={() => setActiveTab('fire-live-center')}
            aria-current={activeTab === 'fire-live-center' ? 'page' : undefined}
          >
            <FireTabIcon />
            <span>AG FIRE LIVE CENTER 🔥</span>
          </button>
          <button
            type="button"
            className={`main-tab horror-vision${activeTab === 'horror-vision' ? ' active' : ''}`}
            onClick={() => setActiveTab('horror-vision')}
            aria-current={activeTab === 'horror-vision' ? 'page' : undefined}
          >
            <HorrorTabIcon />
            <span>HORROR VISION AI</span>
          </button>
          <button
            type="button"
            className={`main-tab creative-studio${activeTab === 'creative-studio' ? ' active' : ''}`}
            onClick={() => setActiveTab('creative-studio')}
            aria-current={activeTab === 'creative-studio' ? 'page' : undefined}
          >
            <Sparkles size={16} />
            <span>AG AI CREATIVE STUDIO</span>
          </button>
        </div>
      </nav>
      {activeTab === 'vision'
        ? <VisionAnalyzer />
        : activeTab === 'support-resistance'
          ? <SupportResistanceAnalyzer />
          : activeTab === 'smart-chart-setup'
            ? <SmartChartSetupAnalyzer />
            : activeTab === 'direction-pro'
              ? <DirectionPro />
              : activeTab === 'fire-live-center'
                ? <FireLiveCenter />
                : activeTab === 'horror-vision'
                  ? <HorrorVisionTracking />
                  : activeTab === 'creative-studio'
                    ? <AgCreativeStudio />
                    : <Dashboard />}
    </div>
  )
}
