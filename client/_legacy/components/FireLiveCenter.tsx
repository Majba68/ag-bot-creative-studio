import {
  createElement, useCallback, useEffect, useRef, useState, type ReactNode,
} from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Crosshair,
  ExternalLink, Eye, FileImage, Flame, ImagePlus, Info, Loader2, MonitorPlay,
  RefreshCw, ShieldAlert, Trash2, Wand2, Zap,
} from 'lucide-react'
import { api } from '../api'
import { useApp } from '../state'
import type { DirectionProAnalysis, DirectionProVerdict } from '../types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg']
const QUOTEX_URL = 'https://quotex.io/'
const WIDGET_DOCS_URL = 'https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/'

type ScreenMode = 'idle' | 'quotex' | 'market'
type LoadedImage = { url: string; name: string; width: number; height: number }

type MarketChoice = {
  label: string
  symbol: string
  note: string
}

type TimeframeChoice = {
  label: string
  value: string
}

const MARKET_CHOICES: MarketChoice[] = [
  { label: 'EUR / USD', symbol: 'OANDA:EURUSD', note: 'Forex spot' },
  { label: 'GBP / USD', symbol: 'OANDA:GBPUSD', note: 'Forex spot' },
  { label: 'USD / JPY', symbol: 'OANDA:USDJPY', note: 'Forex spot' },
  { label: 'BTC / USD', symbol: 'BINANCE:BTCUSDT', note: 'Crypto' },
]

const TIMEFRAMES: TimeframeChoice[] = [
  { label: '1 min', value: '1' },
  { label: '5 min', value: '5' },
  { label: '15 min', value: '15' },
  { label: '30 min', value: '30' },
  { label: '1 hour', value: '60' },
  { label: '4 hours', value: '240' },
  { label: '1 day', value: '1D' },
]

const WIDGET_SCRIPTS = [
  { id: 'advanced-chart', src: 'https://widgets.tradingview-widget.com/w/en/tv-advanced-chart.js' },
  { id: 'technical-analysis', src: 'https://widgets.tradingview-widget.com/w/en/tv-technical-analysis.js' },
]

function assessmentFor(verdict: DirectionProVerdict | undefined) {
  if (verdict === 'UP_BIAS') return { label: 'UP BIAS', tone: 'up', code: 'UP_BIAS' }
  if (verdict === 'DOWN_BIAS') return { label: 'DOWN BIAS', tone: 'down', code: 'DOWN_BIAS' }
  return { label: 'WAIT', tone: 'wait', code: 'INSUFFICIENT_EVIDENCE' }
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

function BulletList({
  title, items, emptyText, tone,
}: { title: string; items: string[]; emptyText: string; tone?: 'up' | 'down' | 'wait' }) {
  return (
    <article className={`flc-card${tone ? ` ${tone}` : ''}`}>
      <h4>{title}</h4>
      {items.length === 0 ? <p>{emptyText}</p> : (
        <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
      )}
    </article>
  )
}

function BengaliBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="flc-bn-block">
      <h4>{title}</h4>
      <p>{text || 'এই অংশে মডেল কোনো পাঠ্য প্রদান করেনি।'}</p>
    </div>
  )
}

function TradingViewWidget({
  tag, attrs, className, label, error,
}: { tag: string; attrs: Record<string, string>; className: string; label: string; error?: string }) {
  const elementRef = useRef<HTMLElement | null>(null)
  const signature = JSON.stringify(attrs)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    element.setAttribute('class', className)
    for (const [name, value] of Object.entries(attrs)) {
      // Official widgets expose camelCase properties; set the property first,
      // then keep both attribute spellings for compatibility with older builds.
      if (name in element) {
        try {
          (element as unknown as Record<string, string>)[name] = value
        } catch {
          // fall through to attributes
        }
      }
      element.setAttribute(name, value)
      element.setAttribute(name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`), value)
    }
  }, [className, signature])

  const placeholder: ReactNode = createElement(
    'div',
    { className: 'flc-widget-placeholder', role: error ? 'alert' : 'status' },
    error || `Loading ${label}…`,
  )

  return createElement(tag, {
    ref: (node: HTMLElement | null) => { elementRef.current = node },
    style: { display: 'block', width: '100%', height: '100%' },
  }, placeholder)
}

function ArcadeBlasterIcon() {
  return (
    <span className="flc-tab-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="flc-blaster-svg">
        <path className="flc-blaster-body" d="M3 15.5h9l2.6-3.1h4.1v6.2h-4.1L12 15.5H3z" />
        <path className="flc-blaster-core" d="M13 12.4h5.7v6.2H13z" />
        <circle className="flc-blaster-spark" cx="20.1" cy="15.5" r="1.35" />
      </svg>
      <Flame className="flc-tab-flame" size={12} />
      <span className="flc-tab-burst" />
    </span>
  )
}

export function FireLiveCenter() {
  const { notify, health } = useApp()
  const visionReady = health?.visionConfigured === true

  const [screenMode, setScreenMode] = useState<ScreenMode>('idle')
  const [symbol, setSymbol] = useState(MARKET_CHOICES[0].symbol)
  const [interval, setInterval] = useState('15')
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<DirectionProAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [widgetErrors, setWidgetErrors] = useState<Record<string, string>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageUrlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
  }, [])

  useEffect(() => {
    if (screenMode !== 'market') return
    for (const widget of WIDGET_SCRIPTS) {
      if (document.querySelector(`script[data-flc-widget="${widget.id}"]`)) continue
      const script = document.createElement('script')
      script.type = 'module'
      script.src = widget.src
      script.async = true
      script.dataset.flcWidget = widget.id
      script.onerror = () => {
        setWidgetErrors((current) => ({
          ...current,
          [widget.id]: `The ${widget.id.replace('-', ' ')} widget script could not be loaded. Check the network connection or CDN access.`,
        }))
      }
      document.body.appendChild(script)
    }
  }, [screenMode])

  const releaseImage = useCallback(() => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current)
      imageUrlRef.current = null
    }
  }, [])

  const acceptFile = useCallback((candidate: File) => {
    const extension = candidate.name.toLowerCase().split('.').pop()
    if (!ACCEPTED_TYPES.includes(candidate.type) || !['png', 'jpg', 'jpeg'].includes(extension ?? '')) {
      notify('Only PNG, JPG or JPEG screenshots are supported.', 'error')
      return
    }
    if (candidate.size > MAX_IMAGE_BYTES) {
      notify('Screenshot must be 5 MB or smaller.', 'error')
      return
    }

    releaseImage()
    const url = URL.createObjectURL(candidate)
    imageUrlRef.current = url
    const probe = new Image()
    probe.onload = () => {
      setImage({ url, name: candidate.name, width: probe.naturalWidth, height: probe.naturalHeight })
      setFile(candidate)
      setAnalysis(null)
      setError(null)
    }
    probe.onerror = () => {
      releaseImage()
      setImage(null)
      setFile(null)
      notify('The selected image could not be opened. Please choose another screenshot.', 'error')
    }
    probe.src = url
  }, [notify, releaseImage])

  const removeImage = useCallback(() => {
    releaseImage()
    setImage(null)
    setFile(null)
    setAnalysis(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [releaseImage])

  const runAnalysis = useCallback(async () => {
    if (!file || !visionReady || analyzing) return
    setAnalyzing(true)
    setError(null)
    setAnalysis(null)
    try {
      const response = await api.directionProAnalyze(file)
      if (!response.available || !response.result) {
        setError(response.error || 'No interpretation was produced.')
        return
      }
      setAnalysis(response.result)
      if (response.result.decision.verdict === 'INSUFFICIENT_EVIDENCE') {
        notify('No usable chart evidence was found. Assessment stays on WAIT.', 'info')
      } else {
        notify('Visible-chart assessment ready. Bengali explanation included.', 'success')
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Chart observation failed.'
      setError(message)
      notify(message, 'error')
    } finally {
      setAnalyzing(false)
    }
  }, [analyzing, file, notify, visionReady])

  const openQuotex = useCallback(() => {
    window.open(QUOTEX_URL, '_blank', 'noopener,noreferrer')
  }, [])

  const selectedMarket = MARKET_CHOICES.find((choice) => choice.symbol === symbol) ?? MARKET_CHOICES[0]
  const selectedTimeframe = TIMEFRAMES.find((choice) => choice.value === interval) ?? TIMEFRAMES[1]
  const assessment = assessmentFor(analysis?.decision.verdict)
  const confidence = analysis?.decision.confidence ?? null
  const uncertainty = confidence === null ? null : Math.max(0, 100 - confidence)
  const screenshot = analysis?.screenshot
  const advanced = analysis?.advancedAnalysis
  const decision = analysis?.decision
  const bengali = analysis?.bengaliExplanation

  const chartAttrs = {
    symbol,
    interval: interval === '1D' ? '1D' : interval,
    timezone: 'Etc/UTC',
    theme: 'dark',
    chartType: 'candles',
    allowSymbolChange: 'true',
  }

  const technicalAttrs = {
    symbol,
    interval: interval === '1D' ? '1D' : interval,
    theme: 'dark',
    ratingsDisplayMode: 'gauge-and-stats',
    hideIntervals: 'true',
  }

  return (
    <div className="flc-page">
      <header className="flc-topbar">
        <div className="flc-brand">
          <span className="flc-mark"><Flame size={22} /></span>
          <div>
            <strong>AG FIRE LIVE CENTER 🔥</strong>
            <small>Official chart embed check · permitted live chart · observed learning</small>
          </div>
        </div>
        <div className="flc-top-actions">
          <span className="flc-status blocked">Quotex embed: blocked</span>
          <span className="flc-status ready">TradingView widget: permitted</span>
          <span className="flc-no-trades"><ShieldAlert size={15} /> No trades · no broker access</span>
        </div>
      </header>

      <main className="flc-main">
        <section className="flc-hero">
          <span className="flc-eyebrow"><Zap size={13} /> LIVE CHART CENTER · EMBED POLICY VERIFIED</span>
          <h1>Fire-powered chart observation. Honest limits. No fake feed.</h1>
          <p>
            Quotex does not provide an official iframe or chart-embed integration. Its live domains return
            <code> X-Frame-Options: SAMEORIGIN</code> and its terms prohibit framing, so this tab never forces a hidden
            or fake Quotex chart. Use the permitted TradingView widget below for a real market chart, then analyze a
            screenshot with the existing Gemini Vision setup for English observations and simple Bengali explanations.
          </p>
        </section>

        <section className="flc-screen-panel">
          <div className="flc-screen-head">
            <div>
              <span className="flc-live-dot" />
              <strong>BLACK SCREEN / MARKET VIEW</strong>
            </div>
            <span>
              {screenMode === 'market'
                ? `${selectedMarket.label} · ${selectedTimeframe.label}`
                : screenMode === 'quotex'
                  ? 'QUOTEX EMBED CHECK RESULT'
                  : 'NO EXTERNAL CHART ACTIVE'}
            </span>
          </div>

          <div className={`flc-screen ${screenMode}`}>
            {screenMode === 'idle' && (
              <div className="flc-screen-idle">
                <div className="flc-idle-burst" aria-hidden="true"><Flame size={44} /></div>
                <h2>Choose your black-screen view</h2>
                <p>
                  Open the Quotex check to see the verified embedding result, or load the permitted live market chart.
                  Nothing redirects this page automatically.
                </p>
                <div className="flc-screen-actions">
                  <button type="button" className="flc-primary" onClick={() => setScreenMode('quotex')}>
                    <MonitorPlay size={16} /> QUOTEX LIVE CHART
                  </button>
                  <button type="button" className="flc-secondary" onClick={() => setScreenMode('market')}>
                    <Activity size={16} /> PERMITTED MARKET CHART
                  </button>
                </div>
              </div>
            )}

            {screenMode === 'quotex' && (
              <div className="flc-quotex-blocked">
                <span className="flc-block-icon"><ShieldAlert size={34} /></span>
                <h2>Quotex embedding is not permitted</h2>
                <p>
                  I checked the official public site and live chart domains. No supported iframe, widget or partner
                  embed API is published. The checked domains reply with <code>X-Frame-Options: SAMEORIGIN</code>, and
                  Quotex terms prohibit framing the site. Showing an embedded Quotex chart here would bypass those
                  protections, so this panel does not attempt it.
                </p>
                <div className="flc-policy-grid">
                  <div><strong>Official embed API</strong><span>None published</span></div>
                  <div><strong>Security header</strong><span>X-Frame-Options: SAMEORIGIN</span></div>
                  <div><strong>Terms of use</strong><span>Framing prohibited</span></div>
                  <div><strong>Fallback chart</strong><span>Fake or simulated chart: never</span></div>
                </div>
                <div className="flc-screen-actions">
                  <button type="button" className="flc-secondary" onClick={() => setScreenMode('market')}>
                    <Activity size={16} /> Use permitted live chart
                  </button>
                  <button type="button" className="flc-ghost" onClick={openQuotex}>
                    <ExternalLink size={15} /> Open quotex.io in a new tab
                  </button>
                  <button type="button" className="flc-ghost" onClick={() => setScreenMode('idle')}>
                    <RefreshCw size={15} /> Back
                  </button>
                </div>
              </div>
            )}

            {screenMode === 'market' && (
              <div className="flc-market-view">
                <div className="flc-market-bar">
                  <label>
                    <span>Pair</span>
                    <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>
                      {MARKET_CHOICES.map((choice) => (
                        <option key={choice.symbol} value={choice.symbol}>
                          {choice.label} · {choice.note}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Timeframe</span>
                    <select value={interval} onChange={(event) => setInterval(event.target.value)}>
                      {TIMEFRAMES.map((choice) => (
                        <option key={choice.value} value={choice.value}>{choice.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flc-market-badge">
                    <strong>{selectedMarket.label}</strong>
                    <span>{selectedTimeframe.label} · real market data</span>
                  </div>
                  <button type="button" className="flc-screen-mini" onClick={() => setScreenMode('idle')}>
                    <RefreshCw size={13} /> Close chart
                  </button>
                </div>

                <div className="flc-widget-stage">
                  <TradingViewWidget
                    tag="tv-advanced-chart"
                    attrs={chartAttrs}
                    className="flc-chart-widget"
                    label="official advanced chart"
                    error={widgetErrors['advanced-chart']}
                  />
                </div>

                <div className="flc-technical-wrap">
                  <div className="flc-technical-title">
                    <BarChart3 size={14} />
                    <span>TradingView technical gauge · moving averages and oscillators</span>
                  </div>
                  <div className="flc-technical-stage">
                    <TradingViewWidget
                      tag="tv-technical-analysis"
                      attrs={technicalAttrs}
                      className="flc-technical-widget"
                      label="official technical analysis"
                      error={widgetErrors['technical-analysis']}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flc-screen-foot">
            <span>
              {screenMode === 'market'
                ? <>Chart and data by <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer nofollow">TradingView</a>. This is an independent market chart, not Quotex.</>
                : 'No chart data is displayed in this state.'}
            </span>
            <a href={WIDGET_DOCS_URL} target="_blank" rel="noopener noreferrer nofollow">
              Official widget documentation <ExternalLink size={12} />
            </a>
          </div>
        </section>

        <div className="flc-learning-grid">
          <section className="flc-panel">
            <div className="flc-panel-head">
              <h2><Eye size={17} /> 1 · What to observe on the chart</h2>
              <span>Educational checklist · no forced signal</span>
            </div>
            <div className="flc-observe-list">
              <div><span>01</span><p><strong>Trend structure</strong> — compare recent highs and lows. Higher highs and higher lows lean upward; lower highs and lower lows lean downward.</p></div>
              <div><span>02</span><p><strong>Candles</strong> — look for rejection wicks, strong bodies, engulfing or breakout candles. A pattern matters more when it appears at a level.</p></div>
              <div><span>03</span><p><strong>Support and resistance</strong> — mark relative areas where price reacted before. Treat them as zones, not exact guaranteed lines.</p></div>
              <div><span>04</span><p><strong>RSI, MACD and Moving Averages</strong> — use only when the panel is readable. Conflicting signals reduce confidence.</p></div>
              <div><span>05</span><p><strong>Wait condition</strong> — unclear candles, missing timeframe, flat or overlapping signals mean WAIT, not a guessed direction.</p></div>
            </div>
            <div className="flc-bn-note" lang="bn">
              <strong>সহজ বাংলা:</strong> প্রথমে দাম কোথায় যাচ্ছে দেখুন। উপরের দিকে বড় ক্যান্ডেল ও শক্তিশালী সমর্থন দেখলে UP BIAS হতে পারে। নিচের দিকে চাপ ও ভাঙা সমর্থন দেখলে DOWN BIAS হতে পারে। চার্ট পরিষ্কার না হলে বা মতামত মেলে না হলে WAIT করুন। কোনো কিছু নিশ্চিত নয়।
            </div>
          </section>

          <section className="flc-panel">
            <div className="flc-panel-head">
              <h2><ImagePlus size={17} /> 2 · Analyze a screenshot</h2>
              <span>PNG · JPG · JPEG · max 5 MB</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(event) => {
                const candidate = event.target.files?.[0]
                if (candidate) acceptFile(candidate)
              }}
            />

            {!image ? (
              <button
                type="button"
                className="flc-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const candidate = event.dataTransfer.files?.[0]
                  if (candidate) acceptFile(candidate)
                }}
              >
                <ImagePlus size={30} />
                <strong>Drop a screenshot of the visible chart</strong>
                <span>Include candles, pair label, timeframe and any indicator panels</span>
                <em>Unreadable labels stay “Not legible” — they are never guessed.</em>
              </button>
            ) : (
              <>
                <div className="flc-preview">
                  <img src={image.url} alt="Uploaded chart screenshot preview" draggable={false} />
                </div>
                <div className="flc-image-tools">
                  <span><FileImage size={13} /> {image.name}{image.width ? ` · ${image.width}×${image.height}` : ''}</span>
                  <button type="button" onClick={() => fileInputRef.current?.click()}><RefreshCw size={13} /> Replace</button>
                  <button type="button" className="danger" onClick={removeImage}><Trash2 size={13} /> Remove</button>
                </div>
              </>
            )}

            <button
              type="button"
              className="flc-analyze"
              onClick={() => void runAnalysis()}
              disabled={!file || !visionReady || analyzing}
            >
              {analyzing ? <Loader2 size={15} className="flc-spin" /> : <Wand2 size={15} />}
              {analyzing
                ? 'Reading visible evidence and preparing assessment…'
                : visionReady ? 'Analyze visible chart' : 'Vision AI not configured'}
            </button>
            {!visionReady && (
              <p className="flc-hint"><AlertTriangle size={13} /> Vision AI is not configured. The existing Gemini key in server/.env is reused; no second key is needed.</p>
            )}
            {error && <p className="flc-error"><AlertTriangle size={13} /> {error}</p>}
          </section>
        </div>

        <section className="flc-panel flc-report">
          <div className="flc-panel-head">
            <h2><Crosshair size={17} /> 3 · Educational assessment</h2>
            <span>One primary result · English report · Bengali explanation</span>
          </div>

          {!analysis ? (
            <div className="flc-empty">
              <Flame size={36} />
              <h3>Assessment: WAIT</h3>
              <p>No screenshot has been analyzed in this session. The tool will not invent a direction, confidence number or market outcome.</p>
            </div>
          ) : (
            <>
              <div className={`flc-assessment ${assessment.tone}`}>
                <div>
                  <span className="flc-assessment-label">PRIMARY RESULT</span>
                  <strong>{assessment.label}</strong>
                  <code>{assessment.code}</code>
                </div>
                <div className="flc-assessment-score">
                  <span>Evidence confidence <strong>{confidence ?? 0}%</strong></span>
                  <span>Uncertainty <strong>{uncertainty ?? 100}%</strong></span>
                  <small>Model evidence score only — not probability, accuracy or profit expectation.</small>
                </div>
              </div>

              <p className="flc-summary">{analysis.summary}</p>

              <div className="flc-section-label"><Eye size={14} /> Visible identification</div>
              <div className="flc-card-grid">
                <article className="flc-card">
                  <h4>Chart labels</h4>
                  <p><strong>Pair:</strong> {screenshot?.pairVisible || 'Not legible'}</p>
                  <p><strong>Timeframe:</strong> {screenshot?.timeframeVisible || 'Not legible'}</p>
                  <p><strong>Chart readable:</strong> {screenshot?.chartReadable ? 'Yes' : 'No'}</p>
                  <p><strong>Candles visible:</strong> {screenshot?.candlesVisible ? 'Yes' : 'No'}</p>
                  <p><strong>Indicators readable:</strong> {screenshot?.indicatorsReadable ? 'Yes' : 'No'}</p>
                </article>
                <BulletList title="Observed facts" items={screenshot?.observedFacts ?? []} emptyText="No clearly observable facts were reported." />
                <BulletList title="Missing information" items={screenshot?.missingInformation ?? []} emptyText="No specific missing information was reported." />
              </div>

              <div className="flc-section-label"><BarChart3 size={14} /> Chart observations</div>
              <div className="flc-card-grid">
                <article className="flc-card">
                  <h4>Market trend</h4>
                  <p>{advanced?.marketTrend || 'Not readable in the screenshot.'}</p>
                </article>
                <BulletList title="Candlestick patterns" items={advanced?.candlestickPatterns ?? []} emptyText="No clear candlestick pattern was reported." />
                <BulletList title="Relative support / resistance" items={advanced?.supportResistance ?? []} emptyText="No clear relative area was reported." tone="wait" />
                <article className="flc-card">
                  <h4>RSI and MACD</h4>
                  <p>{advanced?.rsiMacd || 'Not visible in the screenshot.'}</p>
                </article>
                <article className="flc-card">
                  <h4>Moving Averages</h4>
                  <p>{advanced?.movingAverages || 'Not visible in the screenshot.'}</p>
                </article>
                <article className="flc-card">
                  <h4>Momentum</h4>
                  <p>{advanced?.momentum || 'Not readable in the screenshot.'}</p>
                </article>
                <BulletList title="Breakout / reversal signals" items={advanced?.breakoutReversal ?? []} emptyText="No clear breakout or reversal signal was reported." />
              </div>

              <div className="flc-section-label"><Crosshair size={14} /> Why this assessment</div>
              <div className="flc-reason">
                <strong>Reason:</strong> {decision?.whySelected || 'No reason was provided.'}
              </div>
              <div className="flc-card-grid">
                <BulletList title="Supporting signals" items={decision?.supportingSignals ?? []} emptyText="No supporting signal was reported." tone="up" />
                <BulletList title="Disagreeing signals" items={decision?.disagreeingSignals ?? []} emptyText="No disagreeing signal was reported." tone="wait" />
                <BulletList title="Invalidation conditions" items={decision?.invalidation ?? []} emptyText="No invalidation condition was reported." tone="down" />
              </div>

              <div className="flc-section-label bengali"><span>বাংলা</span> Bengali Explanation</div>
              <div className="flc-bengali" lang="bn">
                <div className="flc-bn-grid">
                  <BengaliBlock title="Overall reading" text={bengali?.summary ?? ''} />
                  <BengaliBlock title="Why this assessment" text={bengali?.whySelected ?? ''} />
                  <BengaliBlock title="How to read the chart" text={bengali?.howToRead ?? ''} />
                  <BengaliBlock title="Risk note" text={bengali?.riskNote ?? ''} />
                </div>
                <div className="flc-bn-scenarios">
                  <div className="up"><h4><ArrowUpRight size={14} /> Possible UP move</h4><p>{bengali?.upScenario || 'কোনো পাঠ্য পাওয়া যায়নি।'}</p></div>
                  <div className="down"><h4><ArrowDownRight size={14} /> Possible DOWN move</h4><p>{bengali?.downScenario || 'কোনো পাঠ্য পাওয়া যায়নি।'}</p></div>
                </div>
              </div>

              <div className="flc-meta">
                <span>Model: {analysis.model}</span>
                <span>Analyzed: {formatTime(analysis.timestamp)}</span>
                <span>Evidence: {analysis.enoughEvidence ? 'screenshot reviewed' : 'insufficient'}</span>
              </div>
              <p className="flc-disclaimer"><AlertTriangle size={14} /> {analysis.disclaimer}</p>
            </>
          )}
        </section>

        <section className="flc-panel flc-safety">
          <div className="flc-panel-head">
            <h2><ShieldAlert size={17} /> 4 · Safe-use rules</h2>
            <span>Read before acting on any observation</span>
          </div>
          <div className="flc-safety-grid">
            <div><Info size={15} /><p><strong>No embedded Quotex chart.</strong> Embedding is blocked by policy and security headers; no bypass, proxy or fake chart is used.</p></div>
            <div><Info size={15} /><p><strong>Real chart, independent source.</strong> TradingView supplies the permitted live widget. It is not a Quotex feed and does not include Quotex OTC symbols.</p></div>
            <div><Info size={15} /><p><strong>No guaranteed prediction.</strong> UP BIAS, DOWN BIAS and WAIT are educational readings with uncertainty, not trade instructions.</p></div>
            <div><Info size={15} /><p><strong>No account access.</strong> This tab never connects to a broker, executes trades, or requests another API key.</p></div>
          </div>
        </section>
      </main>

      <footer className="flc-footer">
        AG FIRE LIVE CENTER is informational only. Quotex is a separate external platform; this tab respects its
        embedding restrictions and does not impersonate its chart. TradingView widgets provide the permitted live
        market chart. Gemini Vision reads only the pixels in your uploaded screenshot and never claims verified
        real-market accuracy, guaranteed profit or trade execution.
      </footer>
    </div>
  )
}

export function FireTabIcon() {
  return <ArcadeBlasterIcon />
}
