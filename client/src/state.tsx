import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react'
import { api } from './api'
import type { Analysis, Health, Interval, MarketPayload, Pair, Settings } from './types'

type Toast = { id: number; text: string; kind: 'info' | 'error' | 'success' } | null

export type AppTab = 'dashboard' | 'vision' | 'support-resistance' | 'smart-chart-setup' | 'direction-pro' | 'fire-live-center' | 'horror-vision' | 'creative-studio'

type AppContextValue = {
  view: 'intro' | 'dashboard'
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void
  start: () => void
  goIntro: () => void
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  pairs: { forex: Pair[]; otc: Pair[]; source: string }
  pairsLoading: boolean
  market: MarketPayload | null
  marketLoading: boolean
  marketError: string | null
  analysis: Analysis | null
  analyzing: boolean
  analysisError: string | null
  runAnalysis: () => Promise<void>
  clearAnalysis: () => void
  assistantOpen: boolean
  setAssistantOpen: (value: boolean) => void
  platformOpen: boolean
  setPlatformOpen: (value: boolean) => void
  toast: Toast
  notify: (text: string, kind?: 'info' | 'error' | 'success') => void
  health: Health | null
}

const AppContext = createContext<AppContextValue | null>(null)

const defaultSettings: Settings = {
  symbol: 'EUR/USD',
  interval: '1min',
  duration: 5,
  marketType: 'forex',
  chartType: 'candlestick',
  indicators: ['ema20', 'ema50', 'bollinger'],
}

const higherIntervalsFor = (interval: Interval): Interval[] => {
  if (interval === '1min') return ['5min', '15min']
  if (interval === '5min') return ['15min', '30min']
  if (interval === '15min') return ['30min', '1h']
  return ['1h']
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<'intro' | 'dashboard'>(() =>
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem('agbot-started') === '1' ? 'dashboard' : 'intro',
  )
  const [activeTab, setActiveTabState] = useState<AppTab>(() => {
    if (typeof sessionStorage === 'undefined') return 'dashboard'
    const stored = sessionStorage.getItem('agbot-tab')
    return stored === 'vision' || stored === 'support-resistance' || stored === 'smart-chart-setup'
      || stored === 'direction-pro' || stored === 'fire-live-center' || stored === 'horror-vision'
      || stored === 'creative-studio'
      ? stored
      : 'dashboard'
  })
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [pairs, setPairs] = useState<{ forex: Pair[]; otc: Pair[]; source: string }>({
    forex: [], otc: [], source: '',
  })
  const [pairsLoading, setPairsLoading] = useState(true)
  const [market, setMarket] = useState<MarketPayload | null>(null)
  const [marketLoading, setMarketLoading] = useState(true)
  const [marketError, setMarketError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [platformOpen, setPlatformOpen] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const [health, setHealth] = useState<Health | null>(null)

  const toastTimer = useRef<number | undefined>(undefined)
  const hasMarketData = useRef(false)

  const notify = useCallback((text: string, kind: 'info' | 'error' | 'success' = 'info') => {
    window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), text, kind })
    toastTimer.current = window.setTimeout(() => setToast(null), 4200)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([api.pairs(), api.health()])
      .then(([pairData, healthData]) => {
        if (!active) return
        setPairs(pairData)
        setHealth(healthData)
      })
      .catch((error: unknown) => {
        if (active) notify(error instanceof Error ? error.message : 'Could not reach the AG BOT API.', 'error')
      })
      .finally(() => {
        if (active) setPairsLoading(false)
      })
    return () => { active = false }
  }, [notify])

  useEffect(() => {
    setAnalysis(null)
    setAnalysisError(null)
    if (settings.marketType === 'otc') {
      setMarket(null)
      setMarketLoading(false)
      setMarketError(null)
      return
    }

    let active = true
    hasMarketData.current = false
    setMarketLoading(true)
    setMarketError(null)

    const load = async () => {
      try {
        const data = await api.candles(settings.symbol, settings.interval)
        if (!active) return
        hasMarketData.current = data.candles.length > 0
        setMarket(data)
      } catch (error) {
        if (active) setMarketError(error instanceof Error ? error.message : 'Market data request failed.')
      } finally {
        if (active) setMarketLoading(false)
      }
    }

    void load()
    const timer = window.setInterval(() => {
      if (!document.hidden) void load()
    }, 20000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [settings.symbol, settings.interval, settings.marketType])

  const runAnalysis = useCallback(async () => {
    if (settings.marketType === 'otc') {
      notify('Broker-synthetic OTC pairs have no independent live feed, so analysis is unavailable.', 'error')
      return
    }
    setAnalyzing(true)
    setAnalysisError(null)
    try {
      const result = await api.analyze(settings.symbol, settings.interval, higherIntervalsFor(settings.interval))
      setAnalysis(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis request failed.'
      setAnalysisError(message)
      notify(message, 'error')
    } finally {
      setAnalyzing(false)
    }
  }, [settings.symbol, settings.interval, settings.marketType, notify])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])

  const setActiveTab = useCallback((tab: AppTab) => {
    sessionStorage.setItem('agbot-tab', tab)
    setActiveTabState(tab)
  }, [])

  const start = useCallback(() => {
    sessionStorage.setItem('agbot-started', '1')
    setView('dashboard')
  }, [])

  const goIntro = useCallback(() => {
    sessionStorage.removeItem('agbot-started')
    setView('intro')
  }, [])

  const clearAnalysis = useCallback(() => setAnalysis(null), [])

  const value: AppContextValue = {
    view, activeTab, setActiveTab, start, goIntro, settings, updateSettings, pairs, pairsLoading,
    market, marketLoading: marketLoading && hasMarketData.current === false,
    marketError, analysis, analyzing, analysisError, runAnalysis, clearAnalysis,
    assistantOpen, setAssistantOpen, platformOpen, setPlatformOpen,
    toast, notify, health,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
