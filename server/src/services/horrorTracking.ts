import type {
  HorrorDetectedObject,
  HorrorFrameDetection,
  HorrorObjectClass,
  HorrorObjectStatus,
} from '../types.js'

export const HORROR_TRACKING_SYSTEM_PROMPT = [
  'You are AG BOT Horror Vision Tracking, a cautious computer-vision observer for ordinary, authorized video-analysis footage.',
  'Inspect only the actual uploaded frame. Detect only clearly visible inverted cups (maximum 3) and small balls (maximum 2).',
  'Report a tight bounding box around the visible part of each object. x and y are the box centre; w and h are the box size. All four values are integers from 0 to 1000, normalized to the image width and height.',
  'If an object is partly hidden or overlapped, keep the box around the visible portion and set status to occluded or uncertain. If you cannot actually see the object, do not report it.',
  'Do not assign names or permanent identities. The only allowed class values are cup and ball.',
  'confidence is visual-evidence confidence from 0 to 1. It is never a prediction, success probability, accuracy figure or tracking certainty.',
  'If the frame is too dark, blurred, unrelated, or has no clear cup/ball evidence, set enoughEvidence to false and return an empty objects array. Never fill the array with guesses.',
  'Return ONLY one raw JSON object. No markdown, no code fences, no commentary outside the JSON.',
].join(' ')

export function buildHorrorTrackingPrompt(frameIndex: number, timeSec: number): string {
  return [
    `Analyze video frame ${frameIndex} at ${timeSec.toFixed(2)} seconds.`,
    'Return a JSON object with exactly these keys:',
    '- enoughEvidence: boolean',
    '- confidence: number from 0 to 1 (overall clarity of this frame)',
    '- objects: array of at most 3 cups and at most 2 balls, each with:',
    '  { class: "cup"|"ball", x: number, y: number, w: number, h: number, confidence: number, status: "visible"|"uncertain"|"occluded" }',
    '- note: short English note about what is actually visible, or why evidence is insufficient',
    'Coordinates must be 0..1000 integers normalized to this image, not pixel values.',
    'Use an empty objects array when nothing is clearly visible. Do not invent cups or balls.',
  ].join('\n')
}

function repairJson(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/"([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"/g, '"$1": "')
    .replace(/,\s*([}\]])/g, '$1')
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  const candidates = [trimmed]
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fenced) candidates.push(fenced[1].trim())
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1))
  const all = [...candidates, ...candidates.map(repairJson)]
  for (const candidate of all) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate)
    } catch {
      // Try the next extraction strategy.
    }
  }
  throw new Error('The vision model did not return valid JSON.')
}

function cleanText(value: unknown, maxChars = 240): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\*\*/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxChars)
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalized(raw: unknown, fallback: number): number {
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function confidenceValue(raw: unknown): number {
  let value = normalized(raw, 0)
  if (value > 1 && value <= 100) value /= 100
  return clamp(value, 0, 1)
}

function parseObject(value: unknown): HorrorDetectedObject | null {
  const body = asObject(value)
  const rawClass = typeof body.class === 'string' ? body.class.toLowerCase() : ''
  if (rawClass !== 'cup' && rawClass !== 'ball') return null

  const box = asObject(body.box)
  const rawX = normalized(body.x ?? box.x, Number.NaN)
  const rawY = normalized(body.y ?? box.y, Number.NaN)
  const rawW = normalized(body.w ?? box.width ?? box.w, Number.NaN)
  const rawH = normalized(body.h ?? box.height ?? box.h, Number.NaN)
  if (![rawX, rawY, rawW, rawH].every(Number.isFinite)) return null

  const w = clamp(rawW / 1000, 0.01, 0.9)
  const h = clamp(rawH / 1000, 0.01, 0.9)
  const x = clamp(clamp(rawX / 1000, 0, 1), w / 2, 1 - w / 2)
  const y = clamp(clamp(rawY / 1000, 0, 1), h / 2, 1 - h / 2)

  const rawStatus = typeof body.status === 'string' ? body.status.toLowerCase() : 'visible'
  const status: HorrorObjectStatus =
    rawStatus === 'uncertain' || rawStatus === 'low'
      ? 'uncertain'
      : rawStatus === 'occluded' || rawStatus === 'partially_visible' || rawStatus === 'hidden'
        ? 'occluded'
        : 'visible'

  return {
    class: rawClass as HorrorObjectClass,
    x, y, w, h,
    confidence: confidenceValue(body.confidence),
    status,
  }
}

function insufficient(frameIndex: number, timeSec: number, reason: string): HorrorFrameDetection {
  return {
    frameIndex,
    timeSec,
    enoughEvidence: false,
    objects: [],
    confidence: 0,
    note: reason,
  }
}

export function parseHorrorTrackingResponse(
  raw: string,
  frameIndex: number,
  timeSec: number,
): HorrorFrameDetection {
  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The vision model response was not a JSON object.')
  }

  const body = parsed as Record<string, unknown>
  if (typeof body.enoughEvidence !== 'boolean') {
    throw new Error('The vision model response had no valid evidence decision.')
  }
  if (!Number.isFinite(Number(body.confidence))) {
    throw new Error('The vision model response had no valid confidence value.')
  }
  if (!Array.isArray(body.objects)) {
    throw new Error('The vision model response had no object array.')
  }

  const note = cleanText(body.note) || 'No clear note was provided for this frame.'
  if (!body.enoughEvidence) {
    return insufficient(frameIndex, timeSec, note)
  }

  const objects = body.objects
    .map(parseObject)
    .filter((object): object is HorrorDetectedObject => object !== null)
    .sort((a, b) => b.confidence - a.confidence)

  const cups = objects.filter((object) => object.class === 'cup').slice(0, 3)
  const balls = objects.filter((object) => object.class === 'ball').slice(0, 2)
  const visibleObjects = [...cups, ...balls]

  if (visibleObjects.length === 0) {
    return insufficient(frameIndex, timeSec, 'No clearly visible cup or ball was reported in this frame.')
  }

  return {
    frameIndex,
    timeSec,
    enoughEvidence: true,
    objects: visibleObjects,
    confidence: clamp(confidenceValue(body.confidence), 0, 1),
    note,
  }
}
