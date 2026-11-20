import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlertTriangle, Check, Clock3, Crop, FileImage, History, ImagePlus, Info,
  Layers, Loader2, RefreshCw, ScanEye, ShieldAlert, SlidersHorizontal,
  Trash2, Upload, X, ZoomIn, ZoomOut,
} from 'lucide-react'
import { api } from '../api'
import { useApp } from '../state'
import type {
  Interval, VisionAnalysis, VisionHistoryEntry, VisionSettings,
} from '../types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg']
const HISTORY_KEY = 'agbot-vision-history'
const HISTORY_LIMIT = 12

const defaultSettings: VisionSettings = {
  pair: 'EUR/USD',
  timeframe: '1min',
  duration: 5,
  marketType: 'forex',
  depth: 'standard',
}

type LoadedImage = { src: string; name: string; width: number; height: number }
type CropRect = { x: number; y: number; w: number; h: number }

function dataUrlToFile(dataUrl: string, name: string): File {
  const [header, payload] = dataUrl.split(',')
  const mime = /data:(image\/[a-zA-Z0-9.+-]+);base64/.exec(header)?.[1] ?? 'image/png'
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type: mime })
}

function downscalePreview(dataUrl: string, maxWidth = 480): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) { resolve(dataUrl); return }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    image.onerror = () => resolve(dataUrl)
    image.src = dataUrl
  })
}

function loadHistory(): VisionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as VisionHistoryEntry[]
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : []
  } catch {
    return []
  }
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function EvidenceList({ title, items, tone }: { title: string; items: string[]; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className={`vision-evidence${tone ? ` ${tone}` : ''}`}>
      <h4>{title}</h4>
      {items.length === 0 ? <p className="vision-muted">None clearly stated.</p> : (
        <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
      )}
    </div>
  )
}

export function VisionAnalyzer() {
  const { pairs, notify, health } = useApp()
  const visionReady = health?.visionConfigured === true
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [zoom, setZoom] = useState(1)
  const [cropMode, setCropMode] = useState(false)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [settings, setSettings] = useState<VisionSettings>(defaultSettings)
  const [analyzing, setAnalyzing] = useState(false)
  const [progressStep, setProgressStep] = useState(0)
  const [result, setResult] = useState<VisionAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<VisionHistoryEntry[]>(() => loadHistory())
  const [compareIds, setCompareIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  const pairOptions = [...pairs.forex, ...pairs.otc]

  const releaseCurrentUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const acceptFile = useCallback((file: File) => {
    const extension = file.name.toLowerCase().split('.').pop()
    if (!ACCEPTED_TYPES.includes(file.type) || !['png', 'jpg', 'jpeg'].includes(extension ?? '')) {
      notify('Only PNG, JPG or JPEG chart screenshots are supported.', 'error')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      notify('Screenshot must be 5 MB or smaller.', 'error')
      return
    }

    releaseCurrentUrl()
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    const probe = new Image()
    probe.onload = () => {
      setImage({ src: url, name: file.name, width: probe.naturalWidth, height: probe.naturalHeight })
      setZoom(1)
      setCropMode(false)
      setCropRect(null)
      setResult(null)
      setError(null)
      notify('Screenshot loaded. You can zoom, crop, replace or remove it.', 'success')
    }
    probe.onerror = () => {
      releaseCurrentUrl()
      notify('That image could not be decoded. Please try another screenshot.', 'error')
    }
    probe.src = url
  }, [notify, releaseCurrentUrl])

  const removeImage = () => {
    releaseCurrentUrl()
    setImage(null)
    setZoom(1)
    setCropMode(false)
    setCropRect(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const pointFromEvent = (event: ReactPointerEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }

  const onCropDown = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (!cropMode || !image) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    dragStartRef.current = point
    setCropRect({ x: point.x, y: point.y, w: 0, h: 0 })
  }

  const onCropMove = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (!cropMode || !dragStartRef.current) return
    const point = pointFromEvent(event)
    const start = dragStartRef.current
    setCropRect({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y),
    })
  }

  const onCropUp = () => {
    dragStartRef.current = null
    setCropRect((current) => current && current.w > 0.02 && current.h > 0.02 ? current : null)
  }

  const applyCrop = () => {
    if (!image || !cropRect || !imageRef.current) return
    const source = imageRef.current
    const canvas = document.createElement('canvas')
    const sx = cropRect.x * image.width
    const sy = cropRect.y * image.height
    const sw = cropRect.w * image.width
    const sh = cropRect.h * image.height
    if (sw < 8 || sh < 8) { notify('Select a larger crop area.', 'error'); return }
    canvas.width = Math.round(sw)
    canvas.height = Math.round(sh)
    const context = canvas.getContext('2d')
    if (!context) { notify('Cropping is not supported by this browser.', 'error'); return }
    context.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    releaseCurrentUrl()
    setImage({
      src: dataUrl,
      name: `cropped-${image.name.replace(/\.[^.]+$/, '')}.jpg`,
      width: canvas.width,
      height: canvas.height,
    })
    setCropMode(false)
    setCropRect(null)
    setResult(null)
    notify('Crop applied. The cropped image is now the active screenshot.', 'success')
  }

  const buildHistoryEntry = useCallback(async (analysis: VisionAnalysis) => {
    if (!image) return null
    const preview = await downscalePreview(image.src)
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: analysis.timestamp,
      imageName: image.name,
      preview,
      settings: { ...settings },
      result: analysis,
    } satisfies VisionHistoryEntry
  }, [image, settings])

  const saveHistory = useCallback((next: VisionHistoryEntry[]) => {
    setHistory(next)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, HISTORY_LIMIT)))
    } catch {
      notify('History storage is full. Oldest entries may not be saved.', 'error')
    }
  }, [notify])

  const runAnalysis = async () => {
    if (!image) { notify('Upload a chart screenshot first.', 'error'); return }
    if (!visionReady) {
      setError('Vision AI Not Configured. Add your key to LLM_API_KEY in server/.env, save, then restart the server. No analysis was produced.')
      setResult(null)
      return
    }
    setAnalyzing(true)
    setProgressStep(0)
    setError(null)
    try {
      const file = image.src.startsWith('data:')
        ? dataUrlToFile(image.src, image.name)
        : await fetch(image.src).then((response) => response.blob()).then((blob) => new File([blob], image.name, { type: blob.type }))
      setProgressStep(1)
      const response = await api.visionAnalyze(file, settings)
      setProgressStep(2)
      if (!response.available || !response.result) {
        setError(response.error ?? 'Vision analysis is unavailable. No interpretation was produced.')
        setResult(null)
        return
      }
      setResult(response.result)
      const entry = await buildHistoryEntry(response.result)
      if (entry) saveHistory([entry, ...history].slice(0, HISTORY_LIMIT))
      notify('Vision analysis completed and saved to local history.', 'success')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Vision analysis failed.'
      setError(message)
      setResult(null)
    } finally {
      setProgressStep(0)
      setAnalyzing(false)
    }
  }

  const reopen = (entry: VisionHistoryEntry) => {
    releaseCurrentUrl()
    setImage({ src: entry.preview, name: entry.imageName, width: 480, height: 320 })
    setSettings(entry.settings)
    setResult(entry.result)
    setError(null)
    notify('Previous analysis reopened. The preview is downscaled — re-upload the original to analyse again.', 'info')
  }

  const toggleCompare = (id: string) => {
    setCompareIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : current.length >= 2 ? [current[1], id] : [...current, id])
  }

  const compared = history.filter((entry) => compareIds.includes(entry.id))

  return (
    <div className="vision-page">
      <header className="vision-topbar">
        <div className="vision-brand">
          <span className="vision-mark"><ScanEye size={22} /></span>
          <div>
            <strong>AG AI VISION ANALYZER</strong>
            <small>Screenshot-based chart analysis · informational only</small>
          </div>
        </div>
        <div className="vision-top-actions">
          <span className={`vision-status ${visionReady ? 'ready' : 'off'}`}>
            {visionReady ? 'Vision AI configured' : 'Vision AI Not Configured'}
          </span>
          <a className="vision-back" href="#dashboard" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <ShieldAlert size={15} /> No trades · no account access
          </a>
        </div>
      </header>

      <main className="vision-main">
        <div className="vision-hero">
          <span className="eyebrow">COMPUTER VISION WORKSPACE</span>
          <h1>Inspect the chart. Question the evidence.</h1>
          <p>
            Upload a Quotex chart screenshot, crop the relevant area and request a conservative visual assessment.
            The model reports what is visible; AG BOT separates observations from interpretation and never claims certainty.
          </p>
        </div>

        <div className="vision-layout">
          <section className="vision-panel upload-panel">
            <div className="vision-panel-head"><h2><Upload size={17} /> 1 · Screenshot</h2><span>PNG · JPG · JPEG · max 5 MB</span></div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) acceptFile(file)
              }}
            />

            {!image ? (
              <button
                type="button"
                className="vision-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const file = event.dataTransfer.files?.[0]
                  if (file) acceptFile(file)
                }}
              >
                <ImagePlus size={34} />
                <strong>Drop in a chart screenshot</strong>
                <span>Drop here or click to choose a PNG, JPG or JPEG from your device</span>
              </button>
            ) : (
              <>
                <div className="vision-preview-wrap">
                  <div className={`vision-preview${cropMode ? ' cropping' : ''}`}>
                    <img
                      ref={imageRef}
                      src={image.src}
                      alt="Uploaded chart screenshot preview"
                      style={{ transform: `scale(${cropMode ? 1 : zoom})` }}
                      onPointerDown={onCropDown}
                      onPointerMove={onCropMove}
                      onPointerUp={onCropUp}
                      onPointerCancel={onCropUp}
                      draggable={false}
                    />
                    {cropRect && (
                      <div
                        className="vision-crop-box"
                        style={{ left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`, width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%` }}
                      />
                    )}
                  </div>
                  {cropMode && (
                    <div className="crop-actions">
                      <span>Drag across the chart to select the area.</span>
                      <button type="button" className="btn-primary btn-small" onClick={applyCrop} disabled={!cropRect}><Check size={14} /> Apply crop</button>
                      <button type="button" className="btn-quiet" onClick={() => { setCropMode(false); setCropRect(null) }}><X size={14} /> Cancel</button>
                    </div>
                  )}
                </div>

                <div className="vision-image-meta">
                  <FileImage size={14} />
                  <span>{image.name} · {image.width}×{image.height}px</span>
                </div>

                <div className="vision-image-tools">
                  <button type="button" onClick={() => fileInputRef.current?.click()}><RefreshCw size={14} /> Replace</button>
                  <button type="button" onClick={() => setCropMode((value) => !value)} className={cropMode ? 'active' : ''}><Crop size={14} /> Crop</button>
                  <button type="button" onClick={() => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))} disabled={cropMode}><ZoomOut size={14} /></button>
                  <span className="zoom-value">{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))} disabled={cropMode}><ZoomIn size={14} /></button>
                  <button type="button" className="danger" onClick={removeImage}><Trash2 size={14} /> Remove</button>
                </div>
              </>
            )}
          </section>

          <section className="vision-panel settings-panel-vision">
            <div className="vision-panel-head"><h2><SlidersHorizontal size={17} /> 2 · Context</h2><span>User-provided, not read from the image</span></div>
            <div className="vision-fields">
              <label>Currency pair
                <select value={settings.pair} onChange={(event) => setSettings({ ...settings, pair: event.target.value })}>
                  {pairOptions.map((pair) => <option key={pair.symbol} value={pair.symbol}>{pair.symbol}</option>)}
                </select>
              </label>
              <label>Timeframe
                <select value={settings.timeframe} onChange={(event) => setSettings({ ...settings, timeframe: event.target.value as Interval })}>
                  {(['1min', '5min', '15min', '30min', '1h'] as Interval[]).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>Candle duration
                <select value={settings.duration} onChange={(event) => setSettings({ ...settings, duration: Number(event.target.value) })}>
                  {[1, 3, 5, 10, 15, 30, 60].map((value) => <option key={value} value={value}>{value} minute{value > 1 ? 's' : ''}</option>)}
                </select>
              </label>
              <label>Market type
                <select value={settings.marketType} onChange={(event) => setSettings({ ...settings, marketType: event.target.value as VisionSettings['marketType'] })}>
                  <option value="forex">Non-OTC</option>
                  <option value="otc">OTC / Synthetic</option>
                </select>
              </label>
              <label>Analysis depth
                <select value={settings.depth} onChange={(event) => setSettings({ ...settings, depth: event.target.value as VisionSettings['depth'] })}>
                  <option value="quick">Quick overview</option>
                  <option value="standard">Standard review</option>
                  <option value="deep">Deep multi-candle review</option>
                </select>
              </label>
            </div>

            {settings.marketType === 'otc' && (
              <div className="vision-note"><Info size={15} /> OTC instruments are broker-generated. No independent feed or trade access is used here.</div>
            )}

            <button
              type="button"
              className="btn-primary btn-block vision-run"
              onClick={() => void runAnalysis()}
              disabled={!image || analyzing || !visionReady}
              title={visionReady ? 'Send the screenshot to the configured vision model' : 'Add a vision API key and restart the server first'}
            >
              {analyzing ? <Loader2 size={16} className="spin" /> : <ScanEye size={16} />}
              {analyzing ? 'Analysing screenshot…' : visionReady ? 'Analyze screenshot' : 'Vision AI not configured'}
            </button>

            {analyzing && (
              <div className="vision-progress" role="status">
                <div className="vision-progress-bar"><span style={{ width: `${(progressStep + 1) * 33.34}%` }} /></div>
                <ul>
                  <li className={progressStep >= 0 ? 'done' : ''}>Preparing image locally</li>
                  <li className={progressStep >= 1 ? 'done' : ''}>Sending to configured vision model</li>
                  <li className={progressStep >= 2 ? 'done' : ''}>Validating structured response</li>
                </ul>
              </div>
            )}

            {error && <div className="vision-error"><AlertTriangle size={16} /><span>{error}</span></div>}

            {!visionReady && (
              <div className="vision-notice">
                <AlertTriangle size={16} />
                <span>
                  <strong>Vision AI Not Configured.</strong> No interpretation will be produced. Add your Gemini key to
                  <code> LLM_API_KEY</code> in <code>server/.env</code>, save, then restart the server.
                </span>
              </div>
            )}
          </section>
        </div>

        <section className="vision-panel vision-result-panel">
          <div className="vision-panel-head"><h2><ScanEye size={17} /> 3 · Analysis result</h2><span>Observations and interpretations are separated</span></div>
          {!result ? (
            <div className="vision-empty">
              <ScanEye size={38} />
              <h3>No analysis produced yet</h3>
              <p>Upload a clear screenshot and run the analyzer. If the image is unclear, the result will ask for another screenshot instead of guessing.</p>
            </div>
          ) : (
            <VisionResultCard result={result} />
          )}
        </section>

        <section className="vision-panel vision-history-panel">
          <div className="vision-panel-head">
            <h2><History size={17} /> 4 · Analysis history</h2>
            <div className="vision-history-actions">
              <span>{history.length}/{HISTORY_LIMIT} saved locally</span>
              <button type="button" onClick={() => {
                if (history.length && window.confirm('Delete all saved vision analyses?')) saveHistory([])
              }} disabled={!history.length}><Trash2 size={14} /> Clear all</button>
            </div>
          </div>

          {history.length === 0 ? <p className="vision-muted">No analyses saved yet.</p> : (
            <>
              <div className="vision-history-grid">
                {history.map((entry) => (
                  <article key={entry.id} className={`vision-history-card${compareIds.includes(entry.id) ? ' picked' : ''}`}>
                    <img src={entry.preview} alt={`Preview for ${entry.imageName}`} />
                    <div className="vision-history-body">
                      <strong>{entry.result.verdict}</strong>
                      <span>{entry.settings.pair} · {entry.settings.timeframe} · {entry.settings.depth}</span>
                      <small><Clock3 size={12} /> {formatTime(entry.createdAt)}</small>
                      <div className="vision-history-buttons">
                        <button type="button" onClick={() => reopen(entry)}>Reopen</button>
                        <button type="button" onClick={() => toggleCompare(entry.id)}><Layers size={13} /> {compareIds.includes(entry.id) ? 'Unpick' : 'Compare'}</button>
                        <button type="button" className="danger" onClick={() => saveHistory(history.filter((item) => item.id !== entry.id))}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {compared.length === 2 && (
                <div className="vision-compare">
                  <h3>Compare two analyses</h3>
                  <div className="vision-compare-grid">
                    {compared.map((entry) => (
                      <div key={entry.id}>
                        <strong>{entry.result.verdict} · {entry.result.confidence}%</strong>
                        <p>{entry.result.summary}</p>
                        <small>{entry.settings.pair} · {formatTime(entry.createdAt)}</small>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="vision-footer">
        AG BOT Vision Analyzer is informational only. It does not access Quotex or any broker account, place trades, guarantee candle direction, or promise profits.
        Model confidence is not the probability of a successful trade.
      </footer>
    </div>
  )
}

function VisionResultCard({ result }: { result: VisionAnalysis }) {
  const verdictClass = result.verdict.toLowerCase()
  return (
    <div className="vision-result">
      <div className="vision-result-headline">
        <div className={`vision-verdict ${verdictClass}`}>
          <span>{result.verdict === 'INSUFFICIENT_DATA' ? 'WAIT' : result.verdict}</span>
          <small>{result.verdict === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT DATA' : 'MODEL ASSESSMENT'}</small>
        </div>
        <div className="vision-confidence">
          <strong>{result.confidence}%</strong>
          <span>model confidence in evidence reading — not market success probability</span>
        </div>
      </div>

      {result.requestAnotherScreenshot && (
        <div className="vision-request"><AlertTriangle size={16} /> The screenshot is too unclear for a reliable reading. Please upload another sharper, uncropped chart image.</div>
      )}

      <p className="vision-summary">{result.summary}</p>
      {result.waitReason && <p className="vision-wait"><Info size={15} /> {result.waitReason}</p>}

      <div className="vision-scenarios">
        <div><h4><Check size={15} /> Potential UP scenario</h4><p>{result.upScenario}</p></div>
        <div><h4><X size={15} /> Potential DOWN scenario</h4><p>{result.downScenario}</p></div>
      </div>

      <div className="vision-evidence-grid">
        <EvidenceList title="Observed facts" items={result.observedFacts} tone="neutral" />
        <EvidenceList title="AI interpretations" items={result.interpretations} tone="neutral" />
        <EvidenceList title="Detected patterns" items={result.detectedPatterns} />
        <EvidenceList title="Bullish evidence" items={result.bullishEvidence} tone="up" />
        <EvidenceList title="Bearish evidence" items={result.bearishEvidence} tone="down" />
        <EvidenceList title="Support / resistance" items={result.supportResistance} />
        <EvidenceList title="Conflicting indicators" items={result.conflictingIndicators} />
        <EvidenceList title="Missing information" items={result.missingInformation} />
        <EvidenceList title="Alternative scenarios" items={result.alternativeScenarios} />
      </div>

      <div className="vision-result-meta">
        <span><strong>Trend strength:</strong> {result.trendStrength}</span>
        <span><strong>Model:</strong> {result.model}</span>
        <span><Clock3 size={12} /> {formatTime(result.timestamp)}</span>
      </div>
      <p className="vision-disclaimer"><ShieldAlert size={14} /> {result.disclaimer}</p>
    </div>
  )
}
