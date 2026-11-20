import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ChevronLeft, ChevronRight, Eye, EyeOff, FileVideo,
  Loader2, Pause, ScanLine, ShieldAlert, Trash2, Upload, Wand2,
} from 'lucide-react'
import { api } from '../api'
import { useApp } from '../state'
import type {
  HorrorDetectedObject, HorrorFrameDetection, HorrorObjectClass,
} from '../types'

const MAX_VIDEO_BYTES = 80 * 1024 * 1024
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const ACCEPTED_EXTENSIONS = ['mp4', 'mov', 'webm']
const SAMPLE_OPTIONS = [8, 12, 16]

type TrackStatus = 'visible' | 'uncertain' | 'occluded' | 'lost'

type TrackPoint = {
  frameIndex: number
  x: number
  y: number
  w: number
  h: number
  status: TrackStatus
  confidence: number
}

type InternalTrack = {
  id: string
  class: HorrorObjectClass
  points: TrackPoint[]
  lastSeen: number
  status: 'active' | 'missing' | 'ended'
}

type FrameTrack = {
  id: string
  class: HorrorObjectClass
  x: number
  y: number
  w: number
  h: number
  confidence: number
  status: TrackStatus
}

type CollectedFrame = {
  index: number
  timeSec: number
  imageUrl: string
  width: number
  height: number
  detection: HorrorFrameDetection
}

type AnalyzedFrame = CollectedFrame & { tracks: FrameTrack[] }

type Summary = {
  uniqueCups: number
  uniqueBalls: number
  maxSimultaneousCups: number
  maxSimultaneousBalls: number
  trackedSeconds: number
  meanConfidence: number
  framesAnalyzed: number
  uncertainFrames: number
  overlapFrames: number
  processingMs: number
}

type Progress = { done: number; total: number; stage: string }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`
}

function statusLabel(status: TrackStatus): string {
  if (status === 'occluded') return 'OCCLUDED'
  if (status === 'uncertain') return 'UNCERTAIN'
  if (status === 'lost') return 'LOST'
  return 'TRACKED'
}

function detectionStatus(detection: HorrorDetectedObject): TrackStatus {
  if (detection.status === 'occluded') return 'occluded'
  if (detection.status === 'uncertain' || detection.confidence < 0.5) return 'uncertain'
  return 'visible'
}

function boxIoU(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const ax1 = a.x - a.w / 2; const ax2 = a.x + a.w / 2
  const ay1 = a.y - a.h / 2; const ay2 = a.y + a.h / 2
  const bx1 = b.x - b.w / 2; const bx2 = b.x + b.w / 2
  const by1 = b.y - b.h / 2; const by2 = b.y + b.h / 2
  const overlapX = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1))
  const overlapY = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1))
  const intersection = overlapX * overlapY
  const union = a.w * a.h + b.w * b.h - intersection
  return union > 0 ? intersection / union : 0
}

function visiblePoints(track: InternalTrack): TrackPoint[] {
  return track.points.filter((point) => point.status !== 'occluded')
}

function predict(track: InternalTrack, frameIndex: number): { x: number; y: number; w: number; h: number } {
  // Include occluded points: they are motion predictions from earlier real detections,
  // so they keep the track anchored instead of snapping it back to the frame centre.
  const points = track.points
  const last = points[points.length - 1]
  if (!last) return { x: 0.5, y: 0.5, w: 0.08, h: 0.12 }
  const previous = points[points.length - 2] ?? last
  const span = Math.max(1, last.frameIndex - previous.frameIndex)
  const velocityX = (last.x - previous.x) / span
  const velocityY = (last.y - previous.y) / span
  const delta = Math.max(1, frameIndex - last.frameIndex)
  return {
    x: clamp(last.x + velocityX * delta * 0.8, 0, 1),
    y: clamp(last.y + velocityY * delta * 0.8, 0, 1),
    w: last.w,
    h: last.h,
  }
}

function buildTracks(frames: CollectedFrame[]) {
  const allTracks: InternalTrack[] = []
  const counters: Record<HorrorObjectClass, number> = { cup: 0, ball: 0 }
  const perFrame: FrameTrack[][] = []

  for (const objectClass of ['cup', 'ball'] as const) {
    const classTracks: InternalTrack[] = []
    const classPerFrame: FrameTrack[][] = []

    for (const frame of frames) {
      const detections = frame.detection.objects.filter(
        (object) => object.class === objectClass && object.confidence > 0,
      )

      const candidates: Array<{ track: InternalTrack; detection: HorrorDetectedObject; cost: number }> = []
      for (const track of classTracks.filter((item) => item.status !== 'ended')) {
        const prediction = predict(track, frame.index)
        for (const detection of detections) {
          const distance = Math.hypot(prediction.x - detection.x, prediction.y - detection.y)
          if (distance > 0.34) continue
          const overlap = boxIoU(prediction, detection)
          candidates.push({
            track,
            detection,
            cost: distance + (1 - overlap) * 0.09 + (1 - detection.confidence) * 0.05 + (track.status === 'missing' ? 0.02 : 0),
          })
        }
      }
      candidates.sort((a, b) => a.cost - b.cost)

      const usedTracks = new Set<string>()
      const usedDetections = new Set<number>()
      for (const candidate of candidates) {
        const detectionPosition = detections.indexOf(candidate.detection)
        if (usedTracks.has(candidate.track.id) || usedDetections.has(detectionPosition)) continue
        const status = detectionStatus(candidate.detection)
        candidate.track.points.push({
          frameIndex: frame.index,
          x: candidate.detection.x,
          y: candidate.detection.y,
          w: candidate.detection.w,
          h: candidate.detection.h,
          status,
          confidence: candidate.detection.confidence,
        })
        candidate.track.lastSeen = frame.index
        candidate.track.status = 'active'
        usedTracks.add(candidate.track.id)
        usedDetections.add(detectionPosition)
      }

      detections.forEach((detection, position) => {
        if (usedDetections.has(position)) return
        counters[objectClass] += 1
        const status = detectionStatus(detection)
        const track: InternalTrack = {
          id: `${objectClass === 'cup' ? 'CUP' : 'BALL'}-${counters[objectClass]}`,
          class: objectClass,
          points: [{
            frameIndex: frame.index,
            x: detection.x,
            y: detection.y,
            w: detection.w,
            h: detection.h,
            status,
            confidence: detection.confidence,
          }],
          lastSeen: frame.index,
          status: 'active',
        }
        classTracks.push(track)
      })

      for (const track of classTracks) {
        if (track.status === 'ended' || track.lastSeen === frame.index) continue
        const gap = frame.index - track.lastSeen
        if (gap <= 5) {
          const prediction = predict(track, frame.index)
          const last = track.points[track.points.length - 1]
          track.status = 'missing'
          track.points.push({
            frameIndex: frame.index,
            ...prediction,
            status: 'occluded',
            confidence: Math.max(0, (last?.confidence ?? 0) - 0.08 * gap),
          })
        } else {
          track.status = 'ended'
        }
      }

      classPerFrame[frame.index] = classTracks
        .filter((track) => track.status !== 'ended')
        .map((track) => {
          const last = track.points[track.points.length - 1]
          return {
            id: track.id,
            class: track.class,
            x: last.x,
            y: last.y,
            w: last.w,
            h: last.h,
            confidence: last.confidence,
            status: last.status,
          }
        })
    }

    allTracks.push(...classTracks)
    classPerFrame.forEach((tracks, index) => {
      perFrame[index] = [...(perFrame[index] ?? []), ...(tracks ?? [])]
    })
  }

  return { tracks: allTracks, perFrame }
}

function buildSummary(
  frames: AnalyzedFrame[], tracks: InternalTrack[], processingMs: number,
): Summary {
  const allVisiblePoints = tracks.flatMap((track) => visiblePoints(track))
  const meanConfidence = allVisiblePoints.length
    ? allVisiblePoints.reduce((total, point) => total + point.confidence, 0) / allVisiblePoints.length * 100
    : 0
  const uncertainFrames = frames.filter((frame) => frame.tracks.some((track) => track.status !== 'visible')).length
  const overlapFrames = frames.filter((frame) => {
    const cups = frame.tracks.filter((track) => track.class === 'cup')
    const balls = frame.tracks.filter((track) => track.class === 'ball')
    const groups = [cups, balls]
    return groups.some((group) => group.some((a, index) => group.slice(index + 1).some((b) => boxIoU(a, b) > 0.3)))
  }).length
  const maxSimultaneous = (objectClass: HorrorObjectClass) => frames.reduce(
    (maximum, frame) => Math.max(maximum, frame.tracks.filter((track) => track.class === objectClass).length),
    0,
  )

  return {
    uniqueCups: tracks.filter((track) => track.class === 'cup').length,
    uniqueBalls: tracks.filter((track) => track.class === 'ball').length,
    maxSimultaneousCups: maxSimultaneous('cup'),
    maxSimultaneousBalls: maxSimultaneous('ball'),
    trackedSeconds: frames.length > 1 ? frames[frames.length - 1].timeSec - frames[0].timeSec : 0,
    meanConfidence: Math.round(meanConfidence),
    framesAnalyzed: frames.length,
    uncertainFrames,
    overlapFrames,
    processingMs,
  }
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer = 0
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      window.clearTimeout(timer)
    }
    const onSeeked = () => { cleanup(); resolve() }
    const onError = () => { cleanup(); reject(new Error('The video could not be decoded at this frame.')) }
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Frame extraction timed out.'))
    }, 8000)
    const target = time <= 0 ? 0.001 : Math.min(time, Math.max(0.002, video.duration - 0.02))
    video.currentTime = target
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The video frame could not be encoded.'))
    }, 'image/jpeg', 0.72)
  })
}

async function extractFrame(video: HTMLVideoElement, time: number, index: number) {
  await seekVideo(video, time)
  const scale = Math.min(1, 960 / Math.max(1, video.videoWidth))
  const width = Math.max(1, Math.round(video.videoWidth * scale))
  const height = Math.max(1, Math.round(video.videoHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available in this browser.')
  context.drawImage(video, 0, 0, width, height)
  const blob = await canvasToBlob(canvas)

  const previewScale = Math.min(1, 720 / width)
  const preview = document.createElement('canvas')
  preview.width = Math.max(1, Math.round(width * previewScale))
  preview.height = Math.max(1, Math.round(height * previewScale))
  const previewContext = preview.getContext('2d')
  if (!previewContext) throw new Error('Canvas is not available in this browser.')
  previewContext.drawImage(canvas, 0, 0, preview.width, preview.height)

  return {
    index,
    timeSec: time,
    imageUrl: preview.toDataURL('image/jpeg', 0.62),
    width: preview.width,
    height: preview.height,
    blob,
  }
}

function FrameCanvas({
  frame, frames, selectedIndex, showPaths,
}: {
  frame: AnalyzedFrame
  frames: AnalyzedFrame[]
  selectedIndex: number
  showPaths: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)

      if (showPaths) {
        const paths = new Map<string, { class: HorrorObjectClass; points: FrameTrack[] }>()
        for (let index = 0; index <= selectedIndex && index < frames.length; index += 1) {
          for (const track of frames[index].tracks) {
            if (!paths.has(track.id)) paths.set(track.id, { class: track.class, points: [] })
            paths.get(track.id)?.points.push(track)
          }
        }
        for (const [id, path] of paths) {
          if (path.points.length < 2) continue
          context.beginPath()
          path.points.forEach((point, order) => {
            const px = point.x * canvas.width
            const py = point.y * canvas.height
            if (order === 0) context.moveTo(px, py)
            else context.lineTo(px, py)
          })
          context.strokeStyle = path.class === 'cup' ? 'rgba(255,59,48,.55)' : 'rgba(255,209,102,.6)'
          context.lineWidth = 2
          context.setLineDash([5, 5])
          context.stroke()
          context.setLineDash([])
          const last = path.points[path.points.length - 1]
          context.fillStyle = path.class === 'cup' ? '#FF6B5F' : '#FFE2A1'
          context.font = '10px monospace'
          context.fillText(id, last.x * canvas.width + 5, last.y * canvas.height - 6)
        }
      }

      for (const track of frame.tracks) {
        const x = (track.x - track.w / 2) * canvas.width
        const y = (track.y - track.h / 2) * canvas.height
        const width = track.w * canvas.width
        const height = track.h * canvas.height
        const color = track.status === 'occluded'
          ? '#B779FF'
          : track.class === 'cup' ? '#FF3B30' : '#FFD166'
        context.strokeStyle = color
        context.lineWidth = track.status === 'visible' ? 2.5 : 1.8
        context.setLineDash(track.status === 'visible' ? [] : [6, 4])
        context.strokeRect(x, y, width, height)
        context.setLineDash([])

        const label = `${track.id} · ${Math.round(track.confidence * 100)}%${track.status !== 'visible' ? ` · ${statusLabel(track.status)}` : ''}`
        context.font = 'bold 12px monospace'
        const labelWidth = context.measureText(label).width + 10
        context.fillStyle = 'rgba(5,5,5,.82)'
        context.fillRect(x, Math.max(0, y - 18), labelWidth, 17)
        context.fillStyle = color
        context.fillText(label, x + 5, Math.max(12, y - 6))
      }
    }
    image.src = frame.imageUrl
    return () => { cancelled = true }
  }, [frame, frames, selectedIndex, showPaths])

  return (
    <canvas
      ref={canvasRef}
      className="hv-frame-canvas"
      width={frame.width}
      height={frame.height}
      aria-label="Annotated video frame with tracking boxes and motion paths"
    />
  )
}

export function HorrorVisionTracking() {
  const { notify, health } = useApp()
  const visionReady = health?.visionConfigured === true

  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoMeta, setVideoMeta] = useState<{ duration: number; width: number; height: number } | null>(null)
  const [sampleCount, setSampleCount] = useState(12)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [frames, setFrames] = useState<AnalyzedFrame[]>([])
  const [tracks, setTracks] = useState<InternalTrack[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showPaths, setShowPaths] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const videoUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
  }, [])

  const clearResults = useCallback(() => {
    setFrames([])
    setTracks([])
    setSummary(null)
    setSelectedIndex(0)
    setProgress(null)
  }, [])

  const acceptVideo = useCallback((candidate: File) => {
    const extension = candidate.name.toLowerCase().split('.').pop() ?? ''
    if (!ACCEPTED_TYPES.includes(candidate.type) && !ACCEPTED_EXTENSIONS.includes(extension)) {
      notify('Only MP4, MOV or WebM videos are supported.', 'error')
      return
    }
    if (candidate.size > MAX_VIDEO_BYTES) {
      notify('Video must be 80 MB or smaller. Long clips can be trimmed before upload.', 'error')
      return
    }

    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    const url = URL.createObjectURL(candidate)
    videoUrlRef.current = url
    setVideoUrl(url)
    setVideoFile(candidate)
    setVideoMeta(null)
    setError(null)
    clearResults()
    notify('Video loaded locally. Analysis sends only sampled frames, never the whole file.', 'info')
  }, [clearResults, notify])

  const removeVideo = useCallback(() => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    videoUrlRef.current = null
    setVideoUrl(null)
    setVideoFile(null)
    setVideoMeta(null)
    setError(null)
    clearResults()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [clearResults])

  const analyzeVideo = useCallback(async () => {
    if (!videoFile || !videoUrl || analyzing) return
    if (!visionReady) {
      setError('Vision AI is not configured. The existing Gemini configuration in server/.env is required.')
      return
    }
    const video = videoRef.current
    const duration = videoMeta?.duration ?? video?.duration ?? 0
    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Video duration is not available yet. Wait for playback metadata to load and try again.')
      return
    }

    setAnalyzing(true)
    setError(null)
    clearResults()

    const startedAt = performance.now()
    const effectiveCount = Math.min(sampleCount, Math.max(2, Math.floor(duration * 4) + 1))
    setProgress({ done: 0, total: effectiveCount, stage: 'Preparing local frame extraction' })

    const extractor = document.createElement('video')
    extractor.src = videoUrl
    extractor.muted = true
    extractor.preload = 'auto'
    extractor.playsInline = true

    const collected: CollectedFrame[] = []
    let failure: string | null = null

    try {
      await new Promise<void>((resolve, reject) => {
        extractor.addEventListener('loadedmetadata', () => resolve(), { once: true })
        extractor.addEventListener('error', () => reject(new Error('The video could not be opened for frame extraction.')), { once: true })
      })

      for (let index = 0; index < effectiveCount; index += 1) {
        const time = effectiveCount === 1 ? 0 : index * duration / (effectiveCount - 1)
        setProgress({ done: index, total: effectiveCount, stage: `Reading frame ${index + 1} of ${effectiveCount}` })
        const extracted = await extractFrame(extractor, time, index)
        const file = new File([extracted.blob], `frame-${index + 1}.jpg`, { type: 'image/jpeg' })
        const response = await api.horrorTrackingFrame(file, index, time)
        if (!response.available || !response.result) {
          throw new Error(response.error || `Frame ${index + 1} could not be analyzed.`)
        }
        collected.push({
          index,
          timeSec: response.result.timeSec,
          imageUrl: extracted.imageUrl,
          width: extracted.width,
          height: extracted.height,
          detection: response.result,
        })
        setProgress({ done: index + 1, total: effectiveCount, stage: `Analyzed frame ${index + 1} of ${effectiveCount}` })
      }
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : 'Video analysis failed.'
    } finally {
      extractor.removeAttribute('src')
      extractor.load()
    }

    if (collected.length > 0) {
      const { tracks: builtTracks, perFrame } = buildTracks(collected)
      const analyzedFrames: AnalyzedFrame[] = collected.map((frame) => ({
        ...frame,
        tracks: perFrame[frame.index] ?? [],
      }))
      const processingMs = Math.round(performance.now() - startedAt)
      setFrames(analyzedFrames)
      setTracks(builtTracks)
      setSummary(buildSummary(analyzedFrames, builtTracks, processingMs))
      setSelectedIndex(0)
      video?.pause()
    }

    if (failure) {
      setError(collected.length > 0
        ? `${failure} Analysis stopped after ${collected.length} frame(s); the partial result below uses only frames that were actually analyzed.`
        : failure)
      notify(failure, 'error')
    } else {
      notify('Tracking pass complete. Inspect each analyzed frame below.', 'success')
    }

    setProgress(null)
    setAnalyzing(false)
  }, [analyzing, clearResults, sampleCount, videoFile, videoMeta, videoUrl, visionReady, notify])

  const inspectCurrentPosition = useCallback(() => {
    const video = videoRef.current
    if (!video || frames.length === 0) return
    video.pause()
    const ratio = video.duration > 0 ? video.currentTime / video.duration : 0
    setSelectedIndex(clamp(Math.round(ratio * (frames.length - 1)), 0, frames.length - 1))
  }, [frames.length])

  const currentFrame = frames[selectedIndex] ?? null
  const percent = progress && progress.total > 0
    ? Math.round(progress.done / progress.total * 100)
    : 0

  return (
    <div className="hv-page">
      <div className="hv-fog hv-fog-a" aria-hidden="true" />
      <div className="hv-fog hv-fog-b" aria-hidden="true" />
      <div className="hv-eyes" aria-hidden="true"><span /><span /></div>
      <div className="hv-scanlines" aria-hidden="true" />

      <header className="hv-topbar">
        <div className="hv-brand">
          <span className="hv-mark"><Eye size={22} /></span>
          <div>
            <strong>AG BOT — HORROR VISION TRACKING ANALYZER</strong>
            <small>Authorized footage only · frames leave this device · no full-video upload</small>
          </div>
        </div>
        <div className="hv-top-status">
          <span className={visionReady ? 'ready' : 'off'}>{visionReady ? 'VISION ONLINE' : 'VISION OFFLINE'}</span>
          <span><ShieldAlert size={14} /> NO GAMBLING · NO TRADES</span>
        </div>
      </header>

      <main className="hv-main">
        <section className="hv-hero">
          <span className="hv-eyebrow"><ScanLine size={13} /> NIGHT SHIFT · VISION UNIT 03</span>
          <h1 className="hv-glitch" data-text="It saw the cup move.">It saw the cup move.</h1>
          <p>
            Upload an authorized cup-and-ball clip. The analyzer samples real video frames, asks the configured
            vision model to identify visible cups and balls, then links detections across frames with unique IDs.
            Hidden or overlapping objects stay uncertain — never invented.
          </p>
        </section>

        <div className="hv-grid">
          <section className="hv-panel hv-intake">
            <div className="hv-panel-head">
              <h2><Upload size={16} /> 1 · Video intake</h2>
              <span>MP4 · MOV · WEBM · max 80 MB</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              hidden
              onChange={(event) => {
                const candidate = event.target.files?.[0]
                if (candidate) acceptVideo(candidate)
              }}
            />

            {!videoFile ? (
              <button
                type="button"
                className="hv-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const candidate = event.dataTransfer.files?.[0]
                  if (candidate) acceptVideo(candidate)
                }}
              >
                <FileVideo size={32} />
                <strong>Drop an authorized video</strong>
                <span>Three cups and one or two visible balls work best</span>
                <em>The file stays in this browser; only sampled frames are sent for analysis.</em>
              </button>
            ) : (
              <>
                <div className="hv-video-wrap">
                  <video
                    ref={videoRef}
                    src={videoUrl ?? undefined}
                    controls
                    playsInline
                    preload="metadata"
                    className="hv-video"
                    onLoadedMetadata={(event) => {
                      const element = event.currentTarget
                      setVideoMeta({
                        duration: element.duration,
                        width: element.videoWidth,
                        height: element.videoHeight,
                      })
                    }}
                    onError={() => setError('This video could not be played by the browser. Try MP4 or WebM.')}
                  />
                </div>
                <div className="hv-file-row">
                  <span><FileVideo size={13} /> {videoFile.name}</span>
                  <button type="button" onClick={() => fileInputRef.current?.click()}>Replace</button>
                  <button type="button" className="danger" onClick={removeVideo}><Trash2 size={13} /> Remove</button>
                </div>
                <div className="hv-video-meta">
                  <span>Duration <strong>{formatDuration(videoMeta?.duration ?? 0)}</strong></span>
                  <span>Resolution <strong>{videoMeta ? `${videoMeta.width}×${videoMeta.height}` : 'loading…'}</strong></span>
                </div>
              </>
            )}

            <label className="hv-sample">
              <span>Frames to analyze</span>
              <select value={sampleCount} onChange={(event) => setSampleCount(Number(event.target.value))} disabled={analyzing}>
                {SAMPLE_OPTIONS.map((option) => <option key={option} value={option}>{option} sampled frames</option>)}
              </select>
            </label>

            <button
              type="button"
              className="hv-analyze"
              onClick={() => void analyzeVideo()}
              disabled={!videoFile || !visionReady || analyzing || !videoMeta}
            >
              {analyzing ? <Loader2 size={17} className="hv-spin" /> : <Wand2 size={17} />}
              {analyzing ? 'ANALYZING VIDEO…' : visionReady ? 'ANALYZE VIDEO' : 'VISION AI NOT CONFIGURED'}
            </button>

            {progress && (
              <div className="hv-progress" role="status">
                <div className="hv-progress-head"><span>{progress.stage}</span><strong>{percent}%</strong></div>
                <div className="hv-progress-track"><span style={{ width: `${percent}%` }} /></div>
                <small>{progress.done} / {progress.total} frames</small>
              </div>
            )}

            {!visionReady && (
              <p className="hv-hint"><AlertTriangle size={13} /> No second API key is needed. The existing Gemini Vision configuration in server/.env is used.</p>
            )}
            {error && <p className="hv-error"><AlertTriangle size={13} /> {error}</p>}
          </section>

          <section className="hv-panel hv-monitor">
            <div className="hv-panel-head">
              <h2><Eye size={16} /> 2 · Tracking monitor</h2>
              <span>{frames.length > 0 ? `${frames.length} analyzed frames` : 'awaiting analysis'}</span>
            </div>

            {!currentFrame ? (
              <div className="hv-empty">
                <div className="hv-empty-eyes" aria-hidden="true"><span /><span /></div>
                <h3>Nothing in the frame yet</h3>
                <p>Upload a clip and run the analysis. Boxes, IDs and motion paths will appear here — and only where visual evidence exists.</p>
              </div>
            ) : (
              <>
                <div className="hv-monitor-tools">
                  <button type="button" onClick={inspectCurrentPosition}><Pause size={13} /> Pause &amp; inspect</button>
                  <button type="button" onClick={() => setSelectedIndex((value) => clamp(value - 1, 0, frames.length - 1))} disabled={selectedIndex === 0}>
                    <ChevronLeft size={13} /> Prev
                  </button>
                  <button type="button" onClick={() => setSelectedIndex((value) => clamp(value + 1, 0, frames.length - 1))} disabled={selectedIndex === frames.length - 1}>
                    Next <ChevronRight size={13} />
                  </button>
                  <button type="button" className={showPaths ? 'on' : ''} onClick={() => setShowPaths((value) => !value)}>
                    {showPaths ? <Eye size={13} /> : <EyeOff size={13} />} Paths
                  </button>
                </div>

                <div className="hv-frame-stage">
                  <FrameCanvas frame={currentFrame} frames={frames} selectedIndex={selectedIndex} showPaths={showPaths} />
                </div>

                <label className="hv-scrubber">
                  <span>Frame {selectedIndex + 1} / {frames.length}</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, frames.length - 1)}
                    value={selectedIndex}
                    onChange={(event) => setSelectedIndex(Number(event.target.value))}
                  />
                  <span>{currentFrame.timeSec.toFixed(2)}s</span>
                </label>

                <div className="hv-detection-row">
                  {currentFrame.tracks.length === 0 ? (
                    <span className="hv-chip none">NO VISIBLE OBJECTS · {currentFrame.detection.note}</span>
                  ) : currentFrame.tracks.map((track) => (
                    <span key={`${track.id}-${track.status}`} className={`hv-chip ${track.class} ${track.status}`}>
                      <strong>{track.id}</strong> {Math.round(track.confidence * 100)}% · {statusLabel(track.status)}
                    </span>
                  ))}
                </div>
                <p className="hv-frame-note">{currentFrame.detection.note}</p>
              </>
            )}
          </section>
        </div>

        <section className="hv-panel hv-dashboard">
          <div className="hv-panel-head">
            <h2><Activity size={16} /> 3 · Results dashboard</h2>
            <span>Measured from analyzed frames only</span>
          </div>

          {!summary ? (
            <div className="hv-empty compact">
              <h3>NO TRACKING DATA</h3>
              <p>Counts, confidence and timing remain blank until a real video analysis runs.</p>
            </div>
          ) : (
            <>
              <div className="hv-stats">
                <div><span>Total cups detected</span><strong>{summary.uniqueCups}</strong><small>unique CUP IDs · max {summary.maxSimultaneousCups} at once</small></div>
                <div><span>Total balls detected</span><strong>{summary.uniqueBalls}</strong><small>unique BALL IDs · max {summary.maxSimultaneousBalls} at once</small></div>
                <div><span>Tracking duration</span><strong>{summary.trackedSeconds.toFixed(2)}s</strong><small>first to last analyzed frame</small></div>
                <div><span>Tracking confidence</span><strong>{summary.meanConfidence}%</strong><small>mean visual evidence, not accuracy</small></div>
                <div><span>Frames analyzed</span><strong>{summary.framesAnalyzed}</strong><small>real decoded video frames</small></div>
                <div><span>Uncertain frames</span><strong>{summary.uncertainFrames}</strong><small>occluded or low-evidence tracks</small></div>
                <div><span>Overlap frames</span><strong>{summary.overlapFrames}</strong><small>bounding boxes intersecting &gt;30%</small></div>
                <div><span>Processing time</span><strong>{(summary.processingMs / 1000).toFixed(1)}s</strong><small>extraction + model analysis</small></div>
              </div>

              <div className="hv-roster">
                <h4>Object identities</h4>
                {tracks.length === 0 ? <p>No object identity was established.</p> : (
                  <div className="hv-roster-list">
                    {tracks.map((track) => {
                      const visible = visiblePoints(track)
                      const last = visible[visible.length - 1]
                      return (
                        <div key={track.id} className={`hv-roster-item ${track.class}`}>
                          <strong>{track.id}</strong>
                          <span>{track.class}</span>
                          <span>{visible.length} visible frames</span>
                          <span>last confidence {last ? `${Math.round(last.confidence * 100)}%` : '—'}</span>
                          <span className={track.status}>{track.status === 'ended' ? 'ID closed' : track.status === 'missing' ? 'temporarily hidden' : 'active'}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <section className="hv-panel hv-safety">
          <div className="hv-panel-head">
            <h2><ShieldAlert size={16} /> 4 · Evidence rules</h2>
            <span>Read before interpreting a result</span>
          </div>
          <div className="hv-safety-grid">
            <div><strong>Authorized footage only.</strong> Upload clips you own or have permission to analyze. No broker, account or live-camera access is used.</div>
            <div><strong>No invented identities.</strong> A track is created only from a detected box. Temporary overlap keeps the ID if the object reappears; otherwise it closes.</div>
            <div><strong>Uncertain stays uncertain.</strong> Dark, blurred or occluded frames are labelled, not smoothed into a confident guess.</div>
            <div><strong>No outcome prediction.</strong> This is visual tracking of pixels, not a claim about where a ball will land or any gambling result.</div>
          </div>
        </section>
      </main>

      <footer className="hv-footer">
        HORROR VISION TRACKING ANALYZER is an educational computer-vision workspace. It uses the existing AG BOT
        Vision configuration, stores no video on the server, and never places trades or predicts game outcomes.
      </footer>
    </div>
  )
}

export function HorrorTabIcon() {
  return (
    <span className="hv-tab-icon" aria-hidden="true">
      <Eye size={16} />
      <span className="hv-tab-pulse" />
    </span>
  )
}
