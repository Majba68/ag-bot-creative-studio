import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Eye, FileImage,
  ImagePlus, Info, Layers, Loader2, RefreshCw, ShieldAlert,
  SlidersHorizontal, Trash2, Upload, Wand2,
} from 'lucide-react'
import { api } from '../api'
import { useApp } from '../state'
import type { SmartChartSetupAnalysis } from '../types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg']

type LoadedImage = { src: string; name: string; width: number; height: number }

function verdictClass(verdict: SmartChartSetupAnalysis['direction']['verdict']): string {
  if (verdict === 'INSUFFICIENT_DATA') return 'insufficient'
  return verdict.toLowerCase()
}

function BulletList({
  title, items, emptyText, tone,
}: { title: string; items: string[]; emptyText: string; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className={`scs-bullets${tone ? ` ${tone}` : ''}`}>
      <h4>{title}</h4>
      {items.length === 0 ? <p>{emptyText}</p> : (
        <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
      )}
    </div>
  )
}

function GuideColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="scs-guide-column">
      <h4>{title}</h4>
      {items.length === 0 ? <p>No item reported.</p> : (
        <ol>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ol>
      )}
    </article>
  )
}

export function SmartChartSetupAnalyzer() {
  const { notify, health } = useApp()
  const visionReady = health?.visionConfigured === true
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<SmartChartSetupAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
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
      const response = await api.smartChartSetupAnalyze(file)
      if (!response.available || !response.result) {
        setError(response.error || 'No interpretation was produced.')
        return
      }
      setResult(response.result)
      if (!response.result.enoughEvidence) {
        notify('The screenshot does not provide enough clear evidence. No setup was recommended.', 'info')
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Smart chart setup analysis failed.'
      setError(message)
      notify(message, 'error')
    } finally {
      setAnalyzing(false)
    }
  }, [analyzing, file, notify, visionReady])

  const review = result?.screenshot
  const guide = result?.setupGuide
  const direction = result?.direction
  const learning = result?.bengaliLearning

  return (
    <div className="scs-page">
      <header className="scs-topbar">
        <div className="scs-brand">
          <span className="scs-mark"><SlidersHorizontal size={22} /></span>
          <div>
            <strong>AG AI SMART CHART SETUP ANALYZER</strong>
            <small>Full dashboard screenshot · educational setup review</small>
          </div>
        </div>
        <div className="scs-top-actions">
          <span className={`scs-status ${visionReady ? 'ready' : 'off'}`}>
            {visionReady ? 'Vision AI configured' : 'Vision AI Not Configured'}
          </span>
          <span className="scs-no-trades"><ShieldAlert size={15} /> No trades · no account access</span>
        </div>
      </header>

      <main className="scs-main">
        <div className="scs-hero">
          <span className="eyebrow">FULL DASHBOARD VISION WORKSPACE</span>
          <h1>Review the chart. Build a cleaner setup.</h1>
          <p>
            Upload one full screenshot of your Trading Dashboard. Gemini Vision reads the visible chart, candles,
            timeframe and indicator labels, then suggests a practical educational setup. The report is in English;
            the learning section is in simple Bengali. No exact prices are calculated or invented.
          </p>
        </div>

        <div className="scs-layout">
          <section className="scs-panel">
            <div className="scs-panel-head">
              <h2><Upload size={17} /> 1 · Full dashboard screenshot</h2>
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
                className="scs-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const candidate = event.dataTransfer.files?.[0]
                  if (candidate) acceptFile(candidate)
                }}
              >
                <ImagePlus size={34} />
                <strong>Drop in one full dashboard screenshot</strong>
                <span>Capture the whole Trading Dashboard, including the chart and any visible indicator labels</span>
                <em>Indicator menu screenshots are not required.</em>
              </button>
            ) : (
              <>
                <div className="scs-preview-wrap">
                  <div className="scs-preview">
                    <img src={image.src} alt="Uploaded full dashboard screenshot preview" draggable={false} />
                  </div>
                </div>
                <div className="scs-image-meta">
                  <FileImage size={14} />
                  <span>{image.name} · {image.width}×{image.height}px</span>
                </div>
                <div className="scs-image-tools">
                  <button type="button" onClick={() => fileInputRef.current?.click()}><RefreshCw size={14} /> Replace</button>
                  <button type="button" className="danger" onClick={removeImage}><Trash2 size={14} /> Remove</button>
                </div>
              </>
            )}

            <button
              type="button"
              className="scs-run"
              onClick={() => void runAnalysis()}
              disabled={!image || !visionReady || analyzing}
              title={visionReady ? 'Send the screenshot to the configured vision model' : 'Configure vision AI first'}
            >
              {analyzing ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
              {analyzing
                ? 'Reading the dashboard and preparing the setup…'
                : visionReady ? 'Analyze chart setup' : 'Vision AI not configured'}
            </button>

            {analyzing && (
              <div className="scs-progress" role="status">
                <span className="spin" /> Inspecting visible evidence, checking tool combinations and writing the Bengali learning notes…
              </div>
            )}
            {error && <div className="scs-error"><AlertTriangle size={16} /><span>{error}</span></div>}
            {!visionReady && (
              <div className="scs-notice">
                <AlertTriangle size={16} />
                <span>
                  <strong>Vision AI Not Configured.</strong> No interpretation will be produced. The existing Gemini
                  key in <code>server/.env</code> is reused; set <code>VISION_MODEL</code> and restart the server.
                </span>
              </div>
            )}
          </section>

          <section className="scs-panel">
            <div className="scs-panel-head">
              <h2><Info size={17} /> 2 · What this tool does</h2>
              <span>One screenshot · clear limits</span>
            </div>
            <div className="scs-how">
              <div><span>01</span><p>Reads only the full dashboard screenshot you upload.</p></div>
              <div><span>02</span><p>Reports only visible chart, candle, timeframe and indicator information.</p></div>
              <div><span>03</span><p>Recommends study tools with settings, optional status and clutter risk.</p></div>
              <div><span>04</span><p>Separates UP evidence, DOWN evidence and conflicts. WAIT is used when evidence is thin.</p></div>
              <div><span>05</span><p>Adds a simple Bengali learning section; no guaranteed direction or profit.</p></div>
            </div>
            <div className="scs-legend">
              <span><i className="scs-dot indicator" /> Indicator</span>
              <span><i className="scs-dot drawing" /> Drawing tool</span>
              <span><i className="scs-dot bengali" /> Bengali notes</span>
            </div>
            <p className="scs-privacy"><ShieldAlert size={14} /> Nothing here connects to Quotex or any broker account.</p>
          </section>
        </div>

        <section className="scs-panel scs-result-panel">
          <div className="scs-panel-head">
            <h2><Layers size={17} /> 3 · Analysis report</h2>
            <span>English report · Bengali learning</span>
          </div>

          {!result ? (
            <div className="scs-empty">
              <Wand2 size={38} />
              <h3>No analysis produced yet</h3>
              <p>
                Upload one clear full-dashboard screenshot and run the analyzer. If the image is not readable,
                the tool will say so instead of guessing indicator names or prices.
              </p>
            </div>
          ) : (
            <>
              <div className={`scs-evidence-banner${result.enoughEvidence ? '' : ' low'}`}>
                {result.enoughEvidence ? <Check size={18} /> : <AlertTriangle size={18} />}
                <div>
                  <strong>
                    {result.enoughEvidence
                      ? 'Enough visible evidence for an educational setup review'
                      : 'Not enough visible evidence in this screenshot'}
                  </strong>
                  <p>{result.summary}</p>
                </div>
                <span className="scs-confidence">{direction?.confidence ?? 0}% evidence confidence</span>
              </div>

              <div className="scs-section-label"><Eye size={15} /> Full dashboard screenshot review</div>
              <div className="scs-review-grid">
                <article className="scs-card">
                  <h4>Visible chart</h4>
                  <div className="scs-mini-facts">
                    <span>Chart area <strong>{review?.chartVisible ? 'Visible' : 'Not confirmed'}</strong></span>
                    <span>Candles <strong>{review?.candlesVisible ? 'Visible' : 'Not confirmed'}</strong></span>
                    <span>Timeframe <strong>{review?.timeframeVisible || 'Not legible'}</strong></span>
                  </div>
                  <p>{review?.chartStructure || 'No chart structure was reported.'}</p>
                </article>

                <article className="scs-card">
                  <h4>Visible indicators</h4>
                  {!review?.visibleIndicators.length ? (
                    <p>No indicator labels were clearly readable in the screenshot.</p>
                  ) : (
                    <div className="scs-chips">
                      {review.visibleIndicators.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
                    </div>
                  )}
                </article>

                <BulletList
                  title="Observed facts"
                  items={review?.observedFacts ?? []}
                  emptyText="No clearly observable facts were reported."
                />
                <BulletList
                  title="Missing information"
                  items={review?.missingInformation ?? []}
                  emptyText="No specific missing information was reported."
                />
              </div>

              <div className="scs-section-label"><SlidersHorizontal size={15} /> Smart tool recommendations</div>
              {!result.recommendations.length ? (
                <div className="scs-inline-empty">No tools were recommended because the evidence was not clear enough.</div>
              ) : (
                <div className="scs-tool-grid">
                  {result.recommendations.map((tool, index) => (
                    <article key={`${tool.name}-${index}`} className={`scs-tool-card ${tool.category}`}>
                      <div className="scs-tool-head">
                        <h4>{tool.name}</h4>
                        <span className="scs-tool-category">{tool.category === 'indicator' ? 'Indicator' : 'Drawing tool'}</span>
                      </div>
                      <p><strong>Why useful:</strong> {tool.whyUseful}</p>
                      <p><strong>Suggested settings:</strong> {tool.suggestedSettings}</p>
                      <div className="scs-tool-badges">
                        <span className={tool.optional ? 'optional' : 'core'}>{tool.optional ? 'Optional' : 'Core suggestion'}</span>
                        <span className={`clutter ${tool.clutterRisk}`}>
                          {tool.clutterRisk === 'high' ? 'May add clutter' : `${tool.clutterRisk} clutter risk`}
                        </span>
                      </div>
                      {tool.clutterNote && <small>{tool.clutterNote}</small>}
                    </article>
                  ))}
                </div>
              )}

              <div className="scs-section-label"><Layers size={15} /> Complete chart setup guide</div>
              <div className="scs-guide-grid">
                <GuideColumn title="Indicators to consider" items={guide?.indicatorsToConsider ?? []} />
                <GuideColumn title="Drawing tools to consider" items={guide?.drawingToolsToConsider ?? []} />
                <GuideColumn title="Settings and configurations" items={guide?.settingsAndConfigurations ?? []} />
                <GuideColumn title="How to combine the tools" items={guide?.howToCombine ?? []} />
                <GuideColumn title="How to read the combined chart" items={guide?.howToReadCombinedChart ?? []} />
              </div>

              <div className="scs-section-label"><ArrowUpRight size={15} /> Candle direction analysis</div>
              <div className="scs-direction-head">
                <span className={`scs-verdict ${direction ? verdictClass(direction.verdict) : 'wait'}`}>
                  {direction?.verdict ?? 'WAIT'}
                </span>
                <div className="scs-direction-meta">
                  <strong>
                    {direction?.enoughInformation
                      ? 'Visible information is sufficient for an educational evidence review'
                      : 'Visible information is not sufficient for a directional view'}
                  </strong>
                  <span>Evidence confidence describes screenshot reading only — not the chance of a correct candle.</span>
                </div>
              </div>
              <div className="scs-direction-grid">
                <BulletList
                  title="Evidence supporting a possible UP movement"
                  items={direction?.upEvidence ?? []}
                  emptyText="No clear UP evidence was visible."
                  tone="up"
                />
                <BulletList
                  title="Evidence supporting a possible DOWN movement"
                  items={direction?.downEvidence ?? []}
                  emptyText="No clear DOWN evidence was visible."
                  tone="down"
                />
                <BulletList
                  title="Conflicting signals"
                  items={direction?.conflictingSignals ?? []}
                  emptyText="No specific conflict was reported."
                  tone="neutral"
                />
              </div>
              {direction?.waitReason && (
                <div className="scs-wait"><Info size={15} /><span><strong>Why WAIT may be better:</strong> {direction.waitReason}</span></div>
              )}
              <p className="scs-mini-disclaimer">
                <AlertTriangle size={14} /> Educational evidence only. This is never a prediction of the next candle.
              </p>

              <div className="scs-section-label bengali"><span>বাংলা</span> Bengali Learning Section</div>
              {learning && (
                <div className="scs-bengali" lang="bn">
                  <div className="scs-bn-grid">
                    <div><h4>Tools to use</h4><ul>{learning.toolsToUse.map((x, i) => <li key={`bt-${i}`}>{x}</li>)}</ul></div>
                    <div><h4>Why tools help</h4><ul>{learning.whyToolsHelp.map((x, i) => <li key={`bw-${i}`}>{x}</li>)}</ul></div>
                    <div><h4>How to configure</h4><ul>{learning.howToConfigure.map((x, i) => <li key={`bc-${i}`}>{x}</li>)}</ul></div>
                    <div><h4>How to read the chart</h4><ul>{learning.howToReadChart.map((x, i) => <li key={`br-${i}`}>{x}</li>)}</ul></div>
                  </div>
                  <div className="scs-bn-scenarios">
                    <div className="up"><h4><ArrowUpRight size={14} /> Possible UP scenario</h4><p>{learning.upScenario}</p></div>
                    <div className="down"><h4><ArrowDownRight size={14} /> Possible DOWN scenario</h4><p>{learning.downScenario}</p></div>
                    <div className="wait"><h4><Info size={14} /> When WAIT is better</h4><p>{learning.waitGuidance}</p></div>
                  </div>
                </div>
              )}

              {direction?.requestAnotherScreenshot && (
                <div className="scs-request">
                  <RefreshCw size={15} /> Please upload one clearer full-dashboard screenshot. Separate indicator menu screenshots are not required.
                </div>
              )}

              <div className="scs-meta">
                <span>Model: {result.model}</span>
                <span>Reviewed: {new Date(result.timestamp).toLocaleString()}</span>
                <span>Evidence: {result.enoughEvidence ? 'screenshot reviewed' : 'insufficient'}</span>
              </div>
              <p className="scs-disclaimer"><AlertTriangle size={14} /> {result.disclaimer}</p>
            </>
          )}
        </section>
      </main>

      <footer className="scs-footer">
        AG BOT Smart Chart Setup Analyzer is informational only. It reads the pixels in your uploaded screenshot;
        it does not access a broker account, place trades, confirm hidden settings, guarantee candle direction, or
        promise profits. “REAL” here means the visible screenshot pixels. Tool recommendations and Bengali notes are
        educational interpretations, not confirmed market facts.
      </footer>
    </div>
  )
}
