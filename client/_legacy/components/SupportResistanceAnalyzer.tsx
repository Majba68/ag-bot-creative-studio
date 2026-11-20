import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, FileImage, ImagePlus,
  Info, Loader2, RefreshCw, ShieldAlert, Trash2, TrendingUp, Upload,
} from 'lucide-react'
import { api } from '../api'
import { useApp } from '../state'
import type { SupportResistanceAnalysis, SupportResistanceZone } from '../types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg']

type LoadedImage = { src: string; name: string; width: number; height: number }

function zoneLabel(type: SupportResistanceZone['type']): string {
  return type === 'support' ? 'SUPPORT' : 'RESISTANCE'
}

function FactList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div className="sr-fact-list">
      <h4>{title}</h4>
      {items.length === 0 ? <p>{emptyText}</p> : (
        <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
      )}
    </div>
  )
}

export function SupportResistanceAnalyzer() {
  const { notify, health } = useApp()
  const visionReady = health?.visionConfigured === true
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<SupportResistanceAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
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

  const acceptFile = useCallback((candidate: File) => {
    const extension = candidate.name.toLowerCase().split('.').pop()
    if (!ACCEPTED_TYPES.includes(candidate.type) || !['png', 'jpg', 'jpeg'].includes(extension ?? '')) {
      notify('Only PNG, JPG or JPEG chart screenshots are supported.', 'error')
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
      setImage({ src: url, name: candidate.name, width: probe.naturalWidth, height: probe.naturalHeight })
      setFile(candidate)
      setResult(null)
      setError(null)
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
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [releaseCurrentUrl])

  const runAnalysis = useCallback(async () => {
    if (!file || !visionReady || analyzing) return
    setAnalyzing(true)
    setError(null)
    setResult(null)
    try {
      const response = await api.supportResistanceAnalyze(file)
      if (!response.available || !response.result) {
        setError(response.error || 'No interpretation was produced.')
        return
      }
      setResult(response.result)
      if (!response.result.enoughEvidence) {
        notify('The screenshot does not provide enough clear evidence. No zones were drawn.', 'info')
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Support and resistance analysis failed.'
      setError(message)
      notify(message, 'error')
    } finally {
      setAnalyzing(false)
    }
  }, [analyzing, file, notify, visionReady])

  // The uploaded image is never modified. This canvas is a separate annotated copy.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image || !result) return

    const source = new Image()
    source.onload = () => {
      const scale = Math.min(1, 2400 / source.naturalWidth)
      canvas.width = Math.max(1, Math.round(source.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(source.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) return

      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      if (!result.enoughEvidence) return

      const lineWidth = Math.max(2, Math.round(canvas.height * 0.0035))
      const fontSize = Math.max(11, Math.min(20, Math.round(canvas.width * 0.017)))
      const textPadX = Math.max(7, Math.round(fontSize * 0.55))
      const textPadY = Math.max(4, Math.round(fontSize * 0.28))

      for (const zone of result.zones) {
        const y = Math.round((zone.yPercent / 100) * canvas.height)
        const support = zone.type === 'support'
        const color = support ? '#16C784' : '#F6465D'
        const label = zoneLabel(zone.type)

        context.save()
        context.strokeStyle = color
        context.lineWidth = lineWidth
        context.globalAlpha = 0.95
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(canvas.width, y)
        context.stroke()

        context.font = `800 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`
        const textWidth = context.measureText(label).width
        const boxWidth = Math.round(textWidth + textPadX * 2)
        const boxHeight = Math.round(fontSize + textPadY * 2)
        let boxY = y - boxHeight - lineWidth * 2
        if (boxY < 4) boxY = y + lineWidth * 2
        if (boxY + boxHeight > canvas.height - 4) {
          boxY = Math.max(4, y - boxHeight - lineWidth * 2)
        }

        context.globalAlpha = 1
        context.fillStyle = support ? 'rgba(7, 48, 35, .94)' : 'rgba(64, 12, 22, .94)'
        context.strokeStyle = color
        context.lineWidth = 1
        context.fillRect(8, boxY, boxWidth, boxHeight)
        context.strokeRect(8, boxY, boxWidth, boxHeight)
        context.fillStyle = color
        context.fillText(label, 8 + textPadX, boxY + textPadY + fontSize * 0.78)
        context.restore()
      }
    }
    source.src = image.src
  }, [image, result])

  const shownZones = result?.enoughEvidence ? result.zones : []
  const hasClearEvidence = result?.enoughEvidence === true

  return (
    <div className="sr-page">
      <header className="sr-topbar">
        <div className="sr-brand">
          <span className="sr-mark"><TrendingUp size={22} /></span>
          <div>
            <strong>AG AI SUPPORT &amp; RESISTANCE ANALYZER</strong>
            <small>Screenshot-based zone review · educational only</small>
          </div>
        </div>
        <div className="sr-top-actions">
          <span className={`sr-status ${visionReady ? 'ready' : 'off'}`}>
            {visionReady ? 'Vision AI configured' : 'Vision AI Not Configured'}
          </span>
          <span className="sr-no-trades"><ShieldAlert size={15} /> No trades · no account access</span>
        </div>
      </header>

      <main className="sr-main">
        <div className="sr-hero">
          <span className="eyebrow">SUPPORT &amp; RESISTANCE WORKSPACE</span>
          <h1>Mark possible zones. Question the evidence.</h1>
          <p>
            Upload a chart screenshot and Gemini Vision will inspect the visible price action for possible
            support and resistance areas. Green and red lines are drawn on a separate annotated copy;
            your original screenshot stays unchanged. No exact prices are calculated or displayed.
          </p>
        </div>

        <div className="sr-layout">
          <section className="sr-panel">
            <div className="sr-panel-head">
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
                className="sr-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const candidate = event.dataTransfer.files?.[0]
                  if (candidate) acceptFile(candidate)
                }}
              >
                <ImagePlus size={34} />
                <strong>Drop in a chart screenshot</strong>
                <span>Click to choose a PNG, JPG or JPEG from your device</span>
              </button>
            ) : (
              <>
                <div className="sr-preview-wrap">
                  <div className="sr-preview">
                    <img src={image.src} alt="Uploaded chart screenshot preview" draggable={false} />
                  </div>
                </div>
                <div className="sr-image-meta">
                  <FileImage size={14} />
                  <span>{image.name} · {image.width}×{image.height}px</span>
                </div>
                <div className="sr-image-tools">
                  <button type="button" onClick={() => fileInputRef.current?.click()}><RefreshCw size={14} /> Replace</button>
                  <button type="button" className="danger" onClick={removeImage}><Trash2 size={14} /> Remove</button>
                </div>
              </>
            )}

            <button
              type="button"
              className="sr-run"
              onClick={() => void runAnalysis()}
              disabled={!image || !visionReady || analyzing}
              title={visionReady ? 'Send the screenshot to the configured vision model' : 'Configure vision AI first'}
            >
              {analyzing ? <Loader2 size={16} className="spin" /> : <TrendingUp size={16} />}
              {analyzing
                ? 'Inspecting visible price action…'
                : visionReady ? 'Analyze support & resistance' : 'Vision AI not configured'}
            </button>

            {analyzing && (
              <div className="sr-progress" role="status">
                <span className="spin" /> Reading the chart, validating evidence and preparing the annotated copy…
              </div>
            )}
            {error && <div className="sr-error"><AlertTriangle size={16} /><span>{error}</span></div>}
            {!visionReady && (
              <div className="sr-notice">
                <AlertTriangle size={16} />
                <span>
                  <strong>Vision AI Not Configured.</strong> No interpretation will be produced. Add your Gemini
                  key to <code>LLM_API_KEY</code> in <code>server/.env</code>, set <code>VISION_MODEL</code>, save,
                  then restart the server.
                </span>
              </div>
            )}
          </section>

          <section className="sr-panel">
            <div className="sr-panel-head">
              <h2><Info size={17} /> 2 · What this tool does</h2>
              <span>Clear limits, no predictions</span>
            </div>
            <div className="sr-how">
              <div><span>01</span><p>Gemini Vision inspects only the screenshot you upload.</p></div>
              <div><span>02</span><p>Possible zones are returned as vertical positions, never as invented prices.</p></div>
              <div><span>03</span><p>Lines appear only when the evidence is clear enough.</p></div>
              <div><span>04</span><p>Breakout and breakdown text is educational, not a guaranteed direction.</p></div>
            </div>
            <div className="sr-legend">
              <span><i className="sr-legend-dot support" /> SUPPORT · green</span>
              <span><i className="sr-legend-dot resistance" /> RESISTANCE · red</span>
            </div>
            <p className="sr-privacy"><ShieldAlert size={14} /> Nothing here connects to Quotex or any broker account.</p>
          </section>
        </div>

        <section className="sr-panel sr-result-panel">
          <div className="sr-panel-head">
            <h2><TrendingUp size={17} /> 3 · Analyzed chart &amp; explanation</h2>
            <span>{shownZones.length} potential zone{shownZones.length === 1 ? '' : 's'} drawn</span>
          </div>

          {!result ? (
            <div className="sr-empty">
              <TrendingUp size={38} />
              <h3>No analysis produced yet</h3>
              <p>Upload a clear screenshot and run the analyzer. If the chart is unclear, the tool will say so instead of drawing guessed lines.</p>
            </div>
          ) : (
            <>
              <div className={`sr-evidence-banner${hasClearEvidence ? '' : ' low'}`}>
                {hasClearEvidence ? <FileImage size={17} /> : <AlertTriangle size={17} />}
                <div>
                  <strong>{hasClearEvidence ? 'Enough visible evidence to mark potential zones' : 'Not enough evidence in this screenshot'}</strong>
                  <p>{result.summary}</p>
                </div>
                <span className="sr-confidence">{result.confidence}% evidence confidence</span>
              </div>

              <div className="sr-chart-grid">
                <article className="sr-chart-card">
                  <div className="sr-chart-card-head">
                    <strong>Original screenshot</strong>
                    <span>Preserved · unchanged</span>
                  </div>
                  <div className="sr-chart-media">
                    {image && <img src={image.src} alt="Original uploaded chart screenshot, unchanged" />}
                  </div>
                </article>

                <article className="sr-chart-card annotated">
                  <div className="sr-chart-card-head">
                    <strong>Annotated chart</strong>
                    <span>Separate overlay · no price values</span>
                  </div>
                  <div className="sr-chart-media">
                    <canvas ref={canvasRef} aria-label="Uploaded chart with potential support and resistance lines" />
                    {shownZones.length === 0 && (
                      <div className="sr-no-lines">No lines drawn — the evidence was not clear enough.</div>
                    )}
                  </div>
                </article>
              </div>

              {shownZones.length > 0 && (
                <div className="sr-zone-list">
                  {shownZones.map((zone, index) => (
                    <div key={`${zone.type}-${index}`} className={`sr-zone-row ${zone.type}`}>
                      <span className="sr-zone-pill">{zoneLabel(zone.type)}</span>
                      <div>
                        <strong>{zone.strength.charAt(0).toUpperCase() + zone.strength.slice(1)} evidence</strong>
                        <p>{zone.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="sr-explain-grid">
                <div className="sr-explain-card support">
                  <h4><ArrowUpRight size={15} /> Why this area may be Support</h4>
                  <p>{result.supportWhy}</p>
                </div>
                <div className="sr-explain-card resistance">
                  <h4><ArrowDownRight size={15} /> Why this area may be Resistance</h4>
                  <p>{result.resistanceWhy}</p>
                </div>
                <div className="sr-explain-card breakout">
                  <h4><ArrowUpRight size={15} /> Possible breakout above Resistance</h4>
                  <p>{result.breakoutMeaning}</p>
                </div>
                <div className="sr-explain-card breakdown">
                  <h4><ArrowDownRight size={15} /> Possible breakdown below Support</h4>
                  <p>{result.breakdownMeaning}</p>
                </div>
              </div>

              <div className="sr-facts-grid">
                <FactList
                  title="Observed facts · REAL screenshot pixels"
                  items={result.observedFacts}
                  emptyText="No clearly observable facts were reported."
                />
                <FactList
                  title="Missing information · not visible"
                  items={result.missingInformation}
                  emptyText="No specific missing information was reported."
                />
              </div>

              {result.requestAnotherScreenshot && (
                <div className="sr-request"><RefreshCw size={15} /> Please upload a sharper, uncropped chart screenshot for a clearer review.</div>
              )}

              <div className="sr-meta">
                <span>Model: {result.model}</span>
                <span>Reviewed: {new Date(result.timestamp).toLocaleString()}</span>
                <span>Evidence: {hasClearEvidence ? 'potential zones visible' : 'insufficient'}</span>
              </div>
              <p className="sr-disclaimer"><AlertTriangle size={14} /> {result.disclaimer}</p>
            </>
          )}
        </section>
      </main>

      <footer className="sr-footer">
        AG BOT Support &amp; Resistance Analyzer is informational only. It does not access any broker account, place
        trades, guarantee candle direction, or promise profits. “REAL DATA” here means the pixels in your uploaded
        screenshot; zone descriptions are AI interpretations of those pixels, not confirmed market facts.
      </footer>
    </div>
  )
}
