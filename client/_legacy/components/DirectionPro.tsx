import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Check,
  Crosshair, Eye, FileImage, History, ImagePlus, Info, Loader2,
  RefreshCw, ShieldAlert, Trash2, Upload, Wand2,
} from 'lucide-react'
import { api } from '../api'
import { useApp } from '../state'
import type {
  DirectionProAnalysis, DirectionProDemoOutcome, DirectionProHistoryEntry,
  DirectionProVerification, DirectionProVerdict, Interval,
} from '../types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg']
const HISTORY_KEY = 'agbot-direction-pro-history'
const HISTORY_LIMIT = 20
const INTERVALS: Interval[] = ['1min', '5min', '15min', '30min', '1h']

type LoadedImage = { src: string; preview: string; name: string; width: number; height: number }
type VerifyForm = { symbol: string; interval: Interval; horizon: number }

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

function verdictClass(verdict: DirectionProVerdict): string {
  if (verdict === 'UP_BIAS') return 'up'
  if (verdict === 'DOWN_BIAS') return 'down'
  return 'insufficient'
}

function verdictLabel(verdict: DirectionProVerdict): string {
  if (verdict === 'UP_BIAS') return 'UP BIAS'
  if (verdict === 'DOWN_BIAS') return 'DOWN BIAS'
  return 'INSUFFICIENT EVIDENCE'
}

function normalizeInterval(value: string | null): Interval {
  const text = (value ?? '').toLowerCase().replace(/\s+/g, '')
  if (text.includes('1h') || text.includes('60m') || text.includes('hour')) return '1h'
  if (text.includes('30')) return '30min'
  if (text.includes('15')) return '15min'
  if (text.includes('5')) return '5min'
  return '1min'
}

function buildPreview(image: HTMLImageElement): string {
  const maxSide = 360
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight, 1))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.72)
}

function loadHistory(): DirectionProHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is DirectionProHistoryEntry =>
      Boolean(item && typeof item === 'object' && (item as DirectionProHistoryEntry).result?.decision?.verdict),
    ).slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

function BulletList({
  title, items, emptyText, tone,
}: { title: string; items: string[]; emptyText: string; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className={`sdp-bullets${tone ? ` ${tone}` : ''}`}>
      <h4>{title}</h4>
      {items.length === 0 ? <p>{emptyText}</p> : (
        <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
      )}
    </div>
  )
}

function BengaliBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="sdp-bn-block">
      <h4>{title}</h4>
      <p>{text || 'এই অংশে মডেল কোনো পাঠ্য প্রদান করেনি।'}</p>
    </div>
  )
}

export function DirectionPro() {
  const { notify, health } = useApp()
  const visionReady = health?.visionConfigured === true
  const demoReady = health?.demoMode === true && health?.dataMode === 'simulated'

  const [image, setImage] = useState<LoadedImage | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<DirectionProAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<DirectionProHistoryEntry[]>(loadHistory)
  const [verifyFormId, setVerifyFormId] = useState<string | null>(null)
  const [verifyForm, setVerifyForm] = useState<VerifyForm>({ symbol: 'EUR/USD', interval: '1min', horizon: 5 })
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  const releaseCurrentUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const persistHistory = useCallback((next: DirectionProHistoryEntry[]) => {
    const limited = next.slice(0, HISTORY_LIMIT)
    setHistory(limited)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(limited))
    } catch {
      notify('History could not be saved in this browser.', 'error')
    }
  }, [notify])

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

    releaseCurrentUrl()
    const url = URL.createObjectURL(candidate)
    objectUrlRef.current = url
    const probe = new Image()
    probe.onload = () => {
      setImage({
        src: url,
        preview: buildPreview(probe),
        name: candidate.name,
        width: probe.naturalWidth,
        height: probe.naturalHeight,
      })
      setFile(candidate)
      setResult(null)
      setError(null)
      setVerifyFormId(null)
    }
    probe.onerror = () => {
      releaseCurrentUrl()
      setImage(null)
      setFile(null)
      notify('The selected image could not be opened. Please choose another screenshot.', 'error')
    }
    probe.src = url
  }, [notify, releaseCurrentUrl])

  const removeImage = useCallback(() => {
    releaseCurrentUrl()
    setImage(null)
    setFile(null)
    setResult(null)
    setError(null)
    setVerifyFormId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [releaseCurrentUrl])

  const runAnalysis = useCallback(async () => {
    if (!file || !visionReady || analyzing) return
    setAnalyzing(true)
    setError(null)
    setResult(null)
    try {
      const response = await api.directionProAnalyze(file)
      if (!response.available || !response.result) {
        setError(response.error || 'No interpretation was produced.')
        return
      }
      const analysis = response.result
      setResult(analysis)
      const entry: DirectionProHistoryEntry = {
        id: makeId(),
        createdAt: analysis.timestamp,
        imageName: image?.name || file.name,
        preview: image?.preview || '',
        pair: analysis.screenshot.pairVisible,
        timeframe: analysis.screenshot.timeframeVisible,
        verdict: analysis.decision.verdict,
        confidence: analysis.decision.confidence,
        result: analysis,
        verification: null,
      }
      persistHistory([entry, ...history].slice(0, HISTORY_LIMIT))
      if (analysis.decision.verdict === 'INSUFFICIENT_EVIDENCE') {
        notify('No usable chart evidence was found. No direction was forced.', 'info')
      } else {
        notify(`${verdictLabel(analysis.decision.verdict)} saved to history.`, 'success')
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Direction analysis failed.'
      setError(message)
      notify(message, 'error')
    } finally {
      setAnalyzing(false)
    }
  }, [analyzing, file, history, image, notify, persistHistory, visionReady])

  const openEntry = useCallback((entry: DirectionProHistoryEntry) => {
    releaseCurrentUrl()
    setImage({ src: entry.preview, preview: entry.preview, name: entry.imageName, width: 0, height: 0 })
    setFile(null)
    setResult(entry.result)
    setError(null)
    setVerifyFormId(null)
    notify('Analysis reopened from history. Upload a new image to re-analyze.', 'info')
  }, [notify, releaseCurrentUrl])

  const deleteEntry = useCallback((id: string) => {
    persistHistory(history.filter((entry) => entry.id !== id))
    if (verifyFormId === id) setVerifyFormId(null)
    notify('History entry removed.', 'info')
  }, [history, notify, persistHistory, verifyFormId])

  const clearHistory = useCallback(() => {
    if (!history.length) return
    if (!window.confirm('Remove all saved Smart Direction Pro analyses from this browser?')) return
    persistHistory([])
    setVerifyFormId(null)
    notify('History cleared.', 'info')
  }, [history.length, notify, persistHistory])

  const startVerification = useCallback((entry: DirectionProHistoryEntry) => {
    setVerifyForm({
      symbol: entry.pair || 'EUR/USD',
      interval: normalizeInterval(entry.timeframe),
      horizon: 5,
    })
    setVerifyFormId(entry.id)
  }, [])

  const submitVerification = useCallback(async (entry: DirectionProHistoryEntry) => {
    if (!demoReady || verifyingId) return
    setVerifyingId(entry.id)
    try {
      const response = await api.directionProVerifyDemo(verifyForm.symbol, verifyForm.interval, verifyForm.horizon)
      if (!response.available || !response.data) {
        throw new Error(response.error || 'Simulated verification was unavailable.')
      }
      const outcome: DirectionProDemoOutcome = response.data.outcome
      const expected: DirectionProDemoOutcome | null =
        entry.verdict === 'UP_BIAS' ? 'UP' : entry.verdict === 'DOWN_BIAS' ? 'DOWN' : null
      const status = expected && expected === outcome ? 'correct' : 'incorrect'
      const verification: DirectionProVerification = {
        status,
        mode: 'demo-simulated',
        outcome,
        symbol: response.data.symbol,
        interval: response.data.interval,
        horizon: response.data.horizon,
        verifiedAt: response.data.generatedAt,
        note: response.data.basis,
      }
      persistHistory(history.map((item) => item.id === entry.id ? { ...item, verification } : item))
      setVerifyFormId(null)
      notify(
        status === 'correct'
          ? 'Simulated verification matched the saved bias.'
          : 'Simulated verification did not match the saved bias.',
        status === 'correct' ? 'success' : 'info',
      )
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Simulated verification failed.', 'error')
    } finally {
      setVerifyingId(null)
    }
  }, [demoReady, history, notify, persistHistory, verifyingId, verifyForm])

  const scored = history.filter((entry) =>
    entry.verification?.status === 'correct' || entry.verification?.status === 'incorrect',
  )
  const correct = scored.filter((entry) => entry.verification?.status === 'correct').length
  const incorrect = scored.length - correct
  const simulatedAccuracy = scored.length ? Math.round((correct / scored.length) * 100) : null

  const review = result?.screenshot
  const advanced = result?.advancedAnalysis
  const decision = result?.decision
  const bengali = result?.bengaliExplanation

  return (
    <div className="sdp-page">
      <header className="sdp-topbar">
        <div className="sdp-brand">
          <span className="sdp-mark"><Crosshair size={22} /></span>
          <div>
            <strong>AG AI SMART DIRECTION PRO</strong>
            <small>Screenshot bias analysis · simulated verification only</small>
          </div>
        </div>
        <div className="sdp-top-actions">
          <span className={`sdp-status ${visionReady ? 'ready' : 'off'}`}>
            {visionReady ? 'Vision AI configured' : 'Vision AI Not Configured'}
          </span>
          <span className={`sdp-status ${demoReady ? 'demo' : 'off'}`}>
            {demoReady ? 'Simulated verification ready' : 'Demo verification unavailable'}
          </span>
          <span className="sdp-no-trades"><ShieldAlert size={15} /> No trades · no account access</span>
        </div>
      </header>

      <main className="sdp-main">
        <div className="sdp-hero">
          <span className="eyebrow">QUOTEX CHART SCREENSHOT · EDUCATIONAL BIAS</span>
          <h1>One clear bias. Honest evidence. No invented data.</h1>
          <p>
            Upload one Quotex chart screenshot. Gemini Vision reads only what is visible and returns one primary result:
            UP BIAS, DOWN BIAS, or INSUFFICIENT EVIDENCE. The English report is supported by a simple Bengali explanation.
            Verification, when available, uses locally simulated demo candles only.
          </p>
        </div>

        <div className="sdp-layout">
          <section className="sdp-panel">
            <div className="sdp-panel-head">
              <h2><Upload size={17} /> 1 · Chart screenshot</h2>
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
                className="sdp-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const candidate = event.dataTransfer.files?.[0]
                  if (candidate) acceptFile(candidate)
                }}
              >
                <ImagePlus size={34} />
                <strong>Drop in one Quotex chart screenshot</strong>
                <span>Include the chart, candles, timeframe and any visible indicator panels</span>
                <em>Hidden settings and unseen values are never guessed.</em>
              </button>
            ) : (
              <>
                <div className="sdp-preview-wrap">
                  <div className="sdp-preview">
                    <img src={image.src} alt="Uploaded Quotex chart screenshot preview" draggable={false} />
                  </div>
                </div>
                <div className="sdp-image-meta">
                  <FileImage size={14} />
                  <span>{image.name}{image.width ? ` · ${image.width}×${image.height}px` : ' · from history'}</span>
                </div>
                <div className="sdp-image-tools">
                  <button type="button" onClick={() => fileInputRef.current?.click()}><RefreshCw size={14} /> Replace</button>
                  <button type="button" className="danger" onClick={removeImage}><Trash2 size={14} /> Remove</button>
                </div>
              </>
            )}

            <button
              type="button"
              className="sdp-run"
              onClick={() => void runAnalysis()}
              disabled={!file || !visionReady || analyzing}
              title={visionReady ? 'Send the screenshot to the configured vision model' : 'Configure vision AI first'}
            >
              {analyzing ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
              {analyzing
                ? 'Reading visible evidence and preparing the bias…'
                : visionReady ? 'Analyze direction' : 'Vision AI not configured'}
            </button>

            {analyzing && (
              <div className="sdp-progress" role="status">
                <span className="spin" /> Checking trend, candles, visible indicators, conflicts and invalidation…
              </div>
            )}
            {error && <div className="sdp-error"><AlertTriangle size={16} /><span>{error}</span></div>}
            {!visionReady && (
              <div className="sdp-notice">
                <AlertTriangle size={16} />
                <span>
                  <strong>Vision AI Not Configured.</strong> No interpretation will be produced. The existing Gemini
                  key in <code>server/.env</code> is reused; no second key is needed.
                </span>
              </div>
            )}
          </section>

          <section className="sdp-panel">
            <div className="sdp-panel-head">
              <h2><Info size={17} /> 2 · Decision rules</h2>
              <span>Read this before using the result</span>
            </div>
            <div className="sdp-rules">
              <div><span>01</span><p><strong>UP BIAS</strong> — chosen only when visible evidence leans upward.</p></div>
              <div><span>02</span><p><strong>DOWN BIAS</strong> — chosen only when visible evidence leans downward.</p></div>
              <div><span>03</span><p><strong>INSUFFICIENT EVIDENCE</strong> — used for unreadable or unusable screenshots. No direction is forced.</p></div>
              <div><span>04</span><p>RSI, MACD, Moving Averages and levels are reported only if visible. Nothing is estimated.</p></div>
              <div><span>05</span><p>Demo verification uses simulated candles. It is never real market accuracy or a profit claim.</p></div>
            </div>
            <div className="sdp-verdict-key">
              <span className="up">UP BIAS</span>
              <span className="down">DOWN BIAS</span>
              <span className="insufficient">INSUFFICIENT EVIDENCE</span>
            </div>
            <p className="sdp-privacy"><ShieldAlert size={14} /> No broker connection, no trade execution, no guaranteed profit.</p>
          </section>
        </div>

        <section className="sdp-panel sdp-result-panel">
          <div className="sdp-panel-head">
            <h2><Crosshair size={17} /> 3 · Direction report</h2>
            <span>English report · Bengali explanation</span>
          </div>

          {!result ? (
            <div className="sdp-empty">
              <Crosshair size={38} />
              <h3>No analysis produced yet</h3>
              <p>Upload one clear chart screenshot and run the analyzer. If the chart is not readable, the tool will say so instead of guessing.</p>
            </div>
          ) : (
            <>
              <div className={`sdp-verdict-banner ${decision ? verdictClass(decision.verdict) : 'insufficient'}`}>
                <div className="sdp-verdict-main">
                  <span className={`sdp-verdict-badge ${decision ? verdictClass(decision.verdict) : 'insufficient'}`}>
                    {decision ? verdictLabel(decision.verdict) : 'INSUFFICIENT EVIDENCE'}
                  </span>
                  <div>
                    <strong>{result.enoughEvidence ? 'Readable chart evidence was found' : 'No usable chart evidence was found'}</strong>
                    <p>{result.summary}</p>
                  </div>
                </div>
                <span className="sdp-confidence">{decision?.confidence ?? 0}% evidence confidence</span>
              </div>

              <div className="sdp-section-label"><Eye size={15} /> Screenshot identification</div>
              <div className="sdp-review-grid">
                <article className="sdp-card">
                  <h4>Visible information</h4>
                  <div className="sdp-mini-facts">
                    <span>Pair <strong>{review?.pairVisible || 'Not legible'}</strong></span>
                    <span>Timeframe <strong>{review?.timeframeVisible || 'Not legible'}</strong></span>
                    <span>Chart readable <strong>{review?.chartReadable ? 'Yes' : 'No'}</strong></span>
                    <span>Candles visible <strong>{review?.candlesVisible ? 'Yes' : 'No'}</strong></span>
                    <span>Indicators readable <strong>{review?.indicatorsReadable ? 'Yes' : 'No'}</strong></span>
                  </div>
                </article>
                <BulletList title="Observed facts" items={review?.observedFacts ?? []} emptyText="No clearly observable facts were reported." />
                <BulletList title="Missing information" items={review?.missingInformation ?? []} emptyText="No specific missing information was reported." />
              </div>

              <div className="sdp-section-label"><BarChart3 size={15} /> Advanced chart analysis</div>
              <div className="sdp-advanced-grid">
                <article className="sdp-card">
                  <h4>Market trend</h4>
                  <p>{advanced?.marketTrend || 'Not readable in the uploaded screenshot.'}</p>
                </article>
                <article className="sdp-card">
                  <h4>Candlestick patterns</h4>
                  <BulletList title="Visible patterns" items={advanced?.candlestickPatterns ?? []} emptyText="No clear candlestick pattern was reported." />
                </article>
                <article className="sdp-card">
                  <h4>Support and resistance</h4>
                  <BulletList title="Relative areas" items={advanced?.supportResistance ?? []} emptyText="No clear relative area was reported." />
                </article>
                <article className="sdp-card">
                  <h4>RSI and MACD</h4>
                  <p>{advanced?.rsiMacd || 'Not visible in the screenshot.'}</p>
                </article>
                <article className="sdp-card">
                  <h4>Moving Averages</h4>
                  <p>{advanced?.movingAverages || 'Not visible in the screenshot.'}</p>
                </article>
                <article className="sdp-card">
                  <h4>Momentum</h4>
                  <p>{advanced?.momentum || 'Not readable in the uploaded screenshot.'}</p>
                </article>
                <article className="sdp-card wide">
                  <h4>Breakout and reversal signals</h4>
                  <BulletList title="Visible signals" items={advanced?.breakoutReversal ?? []} emptyText="No clear breakout or reversal signal was reported." />
                </article>
              </div>

              <div className="sdp-section-label"><Crosshair size={15} /> Why this direction was selected</div>
              <div className="sdp-decision-box">
                <p><strong>Reason:</strong> {decision?.whySelected || 'No reason was provided.'}</p>
              </div>
              <div className="sdp-direction-grid">
                <BulletList title="Signals supporting the bias" items={decision?.supportingSignals ?? []} emptyText="No supporting signal was reported." tone="up" />
                <BulletList title="Signals that disagree" items={decision?.disagreeingSignals ?? []} emptyText="No disagreeing signal was reported." tone="neutral" />
                <BulletList title="What would invalidate this reading" items={decision?.invalidation ?? []} emptyText="No invalidation condition was reported." tone="down" />
              </div>
              <p className="sdp-mini-disclaimer">
                <AlertTriangle size={14} /> A bias is an educational interpretation, not a prediction of the next candle.
              </p>

              <div className="sdp-section-label bengali"><span>বাংলা</span> Bengali Explanation</div>
              <div className="sdp-bengali" lang="bn">
                <div className="sdp-bn-grid">
                  <BengaliBlock title="Overall reading" text={bengali?.summary ?? ''} />
                  <BengaliBlock title="Why this bias" text={bengali?.whySelected ?? ''} />
                  <BengaliBlock title="How to read the chart" text={bengali?.howToRead ?? ''} />
                  <BengaliBlock title="Risk note" text={bengali?.riskNote ?? ''} />
                </div>
                <div className="sdp-bn-scenarios">
                  <div className="up"><h4><ArrowUpRight size={14} /> Possible UP move</h4><p>{bengali?.upScenario || 'কোনো পাঠ্য পাওয়া যায়নি।'}</p></div>
                  <div className="down"><h4><ArrowDownRight size={14} /> Possible DOWN move</h4><p>{bengali?.downScenario || 'কোনো পাঠ্য পাওয়া যায়নি।'}</p></div>
                </div>
              </div>

              <div className="sdp-meta">
                <span>Model: {result.model}</span>
                <span>Analyzed: {formatTime(result.timestamp)}</span>
                <span>Evidence: {result.enoughEvidence ? 'screenshot reviewed' : 'insufficient'}</span>
              </div>
              <p className="sdp-disclaimer"><AlertTriangle size={14} /> {result.disclaimer}</p>
            </>
          )}
        </section>

        <section className="sdp-panel sdp-history-panel">
          <div className="sdp-panel-head">
            <h2><History size={17} /> 4 · Performance tracking</h2>
            <button type="button" className="sdp-clear" onClick={clearHistory} disabled={!history.length}>
              <Trash2 size={13} /> Clear history
            </button>
          </div>

          <div className="sdp-accuracy-warning">
            <AlertTriangle size={16} />
            <span>
              <strong>SIMULATED VERIFICATION ONLY.</strong> Correct/incorrect counts and the accuracy number below are
              calculated only against locally generated demo candles. They are not real market results, not a backtest,
              and not a measure of future trading performance.
            </span>
          </div>

          <div className="sdp-stats">
            <div><span>Saved analyses</span><strong>{history.length}</strong></div>
            <div><span>Verified in demo</span><strong>{scored.length}</strong></div>
            <div><span>Correct</span><strong className="up">{correct}</strong></div>
            <div><span>Incorrect</span><strong className="down">{incorrect}</strong></div>
            <div>
              <span>Simulated accuracy</span>
              <strong>{simulatedAccuracy === null ? '—' : `${simulatedAccuracy}%`}</strong>
              <small>of demo-verified entries only</small>
            </div>
          </div>

          {!history.length ? (
            <div className="sdp-history-empty">
              <History size={30} />
              <p>No saved analyses yet. Each completed screenshot analysis is stored in this browser.</p>
            </div>
          ) : (
            <div className="sdp-history-list">
              {history.map((entry) => (
                <article key={entry.id} className={`sdp-history-item ${verdictClass(entry.verdict)}`}>
                  <div className="sdp-history-thumb">
                    {entry.preview ? <img src={entry.preview} alt="Saved chart preview" /> : <FileImage size={22} />}
                  </div>
                  <div className="sdp-history-info">
                    <div className="sdp-history-title">
                      <strong>{verdictLabel(entry.verdict)}</strong>
                      <span>{formatTime(entry.createdAt)}</span>
                    </div>
                    <p>
                      {entry.pair || 'Pair not legible'} · {entry.timeframe || 'Timeframe not legible'} · {entry.confidence}% evidence confidence
                    </p>
                    <div className="sdp-history-badges">
                      <span className={`sdp-mini-badge ${verdictClass(entry.verdict)}`}>{verdictLabel(entry.verdict)}</span>
                      {entry.verification ? (
                        <span className={`sdp-mini-badge ${entry.verification.status}`}>
                          {entry.verification.status === 'correct' ? 'DEMO CORRECT' : 'DEMO INCORRECT'}
                        </span>
                      ) : (
                        <span className="sdp-mini-badge pending">NOT VERIFIED</span>
                      )}
                    </div>
                    {entry.verification && (
                      <small>
                        Simulated {entry.verification.outcome} outcome · {entry.verification.symbol} {entry.verification.interval} · {entry.verification.horizon} demo bars
                      </small>
                    )}
                  </div>
                  <div className="sdp-history-actions">
                    <button type="button" onClick={() => openEntry(entry)}><Eye size={13} /> Open</button>
                    {entry.verdict !== 'INSUFFICIENT_EVIDENCE' && !entry.verification && (
                      <button
                        type="button"
                        onClick={() => startVerification(entry)}
                        disabled={!demoReady || verifyingId === entry.id}
                        title={demoReady ? 'Compare with a locally simulated demo outcome' : 'Enable DEMO_MODE=true to verify'}
                      >
                        {verifyingId === entry.id ? <Loader2 size={13} className="spin" /> : <BarChart3 size={13} />}
                        Verify
                      </button>
                    )}
                    <button type="button" className="danger" onClick={() => deleteEntry(entry.id)}><Trash2 size={13} /></button>
                  </div>

                  {verifyFormId === entry.id && demoReady && (
                    <div className="sdp-verify-form">
                      <div className="sdp-verify-head">
                        <strong>Simulated demo verification</strong>
                        <button type="button" onClick={() => setVerifyFormId(null)}><span aria-hidden="true">×</span></button>
                      </div>
                      <p>Confirm the demo symbol and interval. If the screenshot label was not legible, enter the symbol you want the local demo generator to use.</p>
                      <div className="sdp-verify-fields">
                        <label>
                          Demo symbol
                          <input
                            value={verifyForm.symbol}
                            onChange={(event) => setVerifyForm((form) => ({ ...form, symbol: event.target.value.toUpperCase() }))}
                            placeholder="EUR/USD"
                          />
                        </label>
                        <label>
                          Interval
                          <select
                            value={verifyForm.interval}
                            onChange={(event) => setVerifyForm((form) => ({ ...form, interval: event.target.value as Interval }))}
                          >
                            {INTERVALS.map((interval) => <option key={interval} value={interval}>{interval}</option>)}
                          </select>
                        </label>
                        <label>
                          Horizon
                          <select
                            value={verifyForm.horizon}
                            onChange={(event) => setVerifyForm((form) => ({ ...form, horizon: Number(event.target.value) }))}
                          >
                            {[1, 3, 5, 10, 20].map((value) => <option key={value} value={value}>{value} demo bars</option>)}
                          </select>
                        </label>
                      </div>
                      <button type="button" onClick={() => void submitVerification(entry)} disabled={verifyingId === entry.id}>
                        {verifyingId === entry.id ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                        Run simulated verification
                      </button>
                      <small>No real prices are fetched. This only labels the saved bias against a deterministic demo outcome.</small>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="sdp-footer">
        AG AI Smart Direction Pro is informational only. It reads the pixels in your uploaded screenshot; it does not
        access a broker account, place trades, confirm hidden settings, guarantee a candle direction, or promise profits.
        Demo verification is simulated and is never presented as verified real-market performance.
      </footer>
    </div>
  )
}
