import { useEffect, useRef, useState, type RefObject } from 'react'
import type { CreativeDesign, CreativeLayer } from '../types'
import { SAFE_AREA } from './creativeStudioUtils'

export type CreativeCanvasEditorProps = {
  design: CreativeDesign
  assetUrls: Record<string, string>
  selectedLayerId: string | null
  onSelectLayer: (id: string | null) => void
  onUpdateLayer: (id: string, patch: Partial<CreativeLayer>) => void
  canvasRef: RefObject<HTMLCanvasElement>
}

const imageCache = new Map<string, HTMLImageElement>()

export function loadCreativeImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      imageCache.set(src, image)
      resolve(image)
    }
    image.onerror = () => reject(new Error('An image could not be loaded.'))
    image.src = src
  })
}

export async function loadCreativeImages(assetUrls: Record<string, string>): Promise<Record<string, HTMLImageElement>> {
  const entries = await Promise.all(
    Object.entries(assetUrls).map(async ([id, url]) => {
      try {
        return [id, await loadCreativeImage(url)] as const
      } catch {
        return null
      }
    }),
  )
  return Object.fromEntries(entries.filter((item): item is readonly [string, HTMLImageElement] => item !== null))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hexToRgba(hex: string, alpha: number): string {
  const value = /^#?[0-9a-f]{6}$/i.test(hex) ? hex.replace('#', '') : 'd4af37'
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  radius = 0,
) {
  if (!image.naturalWidth || !image.naturalHeight || w <= 0 || h <= 0) return
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight)
  const sx = (image.naturalWidth - w / scale) / 2
  const sy = (image.naturalHeight - h / scale) / 2
  ctx.save()
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.clip()
  ctx.drawImage(image, sx, sy, w / scale, h / scale, x, y, w, h)
  ctx.restore()
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  if (!image.naturalWidth || !image.naturalHeight || w <= 0 || h <= 0) return
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight)
  const drawW = image.naturalWidth * scale
  const drawH = image.naturalHeight * scale
  ctx.drawImage(image, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH)
}

/** Canvas measurement that always includes manual letter-spacing. */
function measureTracked(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  if (!spacing) return ctx.measureText(text).width
  let width = 0
  for (const char of text) width += ctx.measureText(char).width + spacing
  return Math.max(0, width - spacing)
}

/** Draw with manual tracking so alignment is identical in every browser. */
function fillTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchor: number,
  y: number,
  align: 'left' | 'center' | 'right',
  spacing: number,
) {
  if (!spacing) {
    ctx.textAlign = align
    ctx.fillText(text, anchor, y)
    ctx.textAlign = 'left'
    return
  }
  const width = measureTracked(ctx, text, spacing)
  let cursor = align === 'center' ? anchor - width / 2 : align === 'right' ? anchor - width : anchor
  ctx.textAlign = 'left'
  for (const char of text) {
    ctx.fillText(char, cursor, y)
    cursor += ctx.measureText(char).width + spacing
  }
}

/** Break one over-long token without adding/removing any character. */
function splitLongWord(ctx: CanvasRenderingContext2D, word: string, maxWidth: number, spacing: number): string[] {
  const parts: string[] = []
  let current = ''
  for (const char of word) {
    const candidate = current + char
    if (current && measureTracked(ctx, candidate, spacing) > maxWidth) {
      parts.push(current)
      current = char
    } else {
      current = candidate
    }
  }
  if (current) parts.push(current)
  return parts.length ? parts : [word]
}

/** Word wrap with character-level fallback for URLs / long unbroken names. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, spacing: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (measureTracked(ctx, candidate, spacing) <= maxWidth) {
        current = candidate
        continue
      }
      if (current) {
        lines.push(current)
        current = ''
      }
      if (measureTracked(ctx, word, spacing) <= maxWidth) {
        current = word
        continue
      }
      const parts = splitLongWord(ctx, word, maxWidth, spacing)
      parts.forEach((part, index) => {
        if (index === parts.length - 1) current = part
        else lines.push(part)
      })
    }
    if (current) lines.push(current)
  }
  return lines.length ? lines : ['']
}

type FittedText = { font: number; spacing: number; lines: string[]; lineHeight: number }

/**
 * Shrink the font until every wrapped line fits the layer box both horizontally
 * and vertically. No line is ever truncated: user facts stay exact.
 */
function fitTextToBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  boxWidth: number,
  boxHeight: number,
  font: number,
  spacing: number,
  weight: number,
  family: string,
  lineHeightRatio: number,
): FittedText {
  let currentFont = Math.max(1, font)
  const currentSpacing = spacing
  let lines = [text]
  for (let attempt = 0; attempt < 40; attempt += 1) {
    ctx.font = `${weight} ${currentFont}px ${family}`
    lines = wrapText(ctx, text, boxWidth, currentSpacing)
    const lineHeight = currentFont * lineHeightRatio
    const widest = Math.max(...lines.map((line) => measureTracked(ctx, line, currentSpacing)), 0)
    if (lines.length * lineHeight <= boxHeight && widest <= boxWidth + 0.5) {
      return { font: currentFont, spacing: currentSpacing, lines, lineHeight }
    }
    if (currentFont <= 1.5) break
    currentFont = Math.max(1.5, currentFont * 0.84)
  }
  ctx.font = `${weight} ${currentFont}px ${family}`
  return { font: currentFont, spacing: currentSpacing, lines, lineHeight: currentFont * lineHeightRatio }
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: CreativeLayer,
  design: CreativeDesign,
  sx: number,
  sy: number,
) {
  const text = (layer.text || '').trim()
  if (!text) return

  // Keep every generated element inside the safe area, even after manual dragging.
  const insetX = SAFE_AREA.left * design.width * sx
  const insetTop = SAFE_AREA.top * design.height * sy
  const maxRight = SAFE_AREA.right * design.width * sx
  const maxBottom = SAFE_AREA.bottom * design.height * sy
  const x = clamp(layer.x * design.width * sx, insetX, Math.max(insetX, maxRight - 1))
  const y = clamp(layer.y * design.height * sy, insetTop, Math.max(insetTop, maxBottom - 1))
  const w = Math.max(1, Math.min(layer.w * design.width * sx, maxRight - x))
  const h = Math.max(1, Math.min(layer.h * design.height * sy, maxBottom - y))
  const weight = layer.weight || 700
  const family = layer.fontFamily || 'Inter, Arial, sans-serif'
  const fitted = fitTextToBox(
    ctx, text, w, h,
    Math.max(1, (layer.fontSize || 36) * sx),
    (layer.letterSpacing || 0) * sx,
    weight, family, layer.lineHeight || 1.12,
  )
  const align = layer.align || 'left'
  const anchor = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x

  ctx.save()
  ctx.globalAlpha = layer.opacity ?? 1
  ctx.font = `${weight} ${fitted.font}px ${family}`
  ctx.fillStyle = layer.color || design.palette.text
  ctx.textBaseline = 'top'
  if (design.effects.shadows) {
    ctx.shadowColor = 'rgba(0,0,0,.72)'
    ctx.shadowBlur = Math.max(2, fitted.font * 0.18)
    ctx.shadowOffsetY = Math.max(1, fitted.font * 0.06)
  }
  if (design.effects.threeD && layer.role === 'primary') {
    ctx.save()
    ctx.globalAlpha = (layer.opacity ?? 1) * 0.32
    ctx.fillStyle = hexToRgba(design.palette.accent, 0.9)
    fitted.lines.forEach((line, index) => {
      fillTracked(ctx, line, anchor + fitted.font * 0.035, y + index * fitted.lineHeight + fitted.font * 0.035, align, fitted.spacing)
    })
    ctx.restore()
  }
  fitted.lines.forEach((line, index) => {
    fillTracked(ctx, line, anchor, y + index * fitted.lineHeight, align, fitted.spacing)
  })
  ctx.restore()
}

export function renderDesign(
  canvas: HTMLCanvasElement,
  design: CreativeDesign,
  images: Record<string, HTMLImageElement>,
  selectedId: string | null = null,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const sx = canvas.width / design.width
  const sy = canvas.height / design.height
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, design.palette.primary)
  gradient.addColorStop(0.58, design.palette.secondary)
  gradient.addColorStop(1, design.palette.primary)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const background = design.backgroundAssetId ? images[design.backgroundAssetId] : null
  if (background) {
    drawCover(ctx, background, 0, 0, canvas.width, canvas.height)
    if (design.effects.gradient) {
      const shade = ctx.createLinearGradient(0, 0, 0, canvas.height)
      shade.addColorStop(0, hexToRgba(design.palette.primary, 0.22))
      shade.addColorStop(0.55, 'rgba(0,0,0,0.12)')
      shade.addColorStop(1, hexToRgba(design.palette.primary, 0.88))
      ctx.fillStyle = shade
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }

  if (design.effects.lighting) {
    const glow = ctx.createRadialGradient(
      canvas.width * 0.78, canvas.height * 0.16, 0,
      canvas.width * 0.78, canvas.height * 0.16, canvas.width * 0.8,
    )
    glow.addColorStop(0, hexToRgba(design.palette.accent, 0.32))
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  if (design.effects.graphics) {
    ctx.save()
    ctx.strokeStyle = hexToRgba(design.palette.accent, 0.22)
    ctx.lineWidth = Math.max(1, 2 * sx)
    for (let i = 0; i < 5; i += 1) {
      const offset = (i + 1) * canvas.width * 0.17
      ctx.beginPath()
      ctx.moveTo(offset, 0)
      ctx.lineTo(offset - canvas.height * 0.32, canvas.height)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(canvas.width * 0.82, canvas.height * 0.24, canvas.width * 0.19, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  for (const layer of design.layers) {
    if (layer.type === 'worker' || layer.type === 'logo') {
      const image = layer.assetId ? images[layer.assetId] : null
      if (!image) continue
      const x = layer.x * design.width * sx
      const y = layer.y * design.height * sy
      const w = layer.w * design.width * sx
      const h = layer.h * design.height * sy
      ctx.save()
      ctx.globalAlpha = layer.opacity ?? 1
      if (design.effects.shadows && layer.type === 'logo') {
        ctx.shadowColor = 'rgba(0,0,0,.55)'
        ctx.shadowBlur = 16 * sx
      }
      if (layer.type === 'worker') drawCover(ctx, image, x, y, w, h, (layer.radius || 18) * sx)
      else drawContain(ctx, image, x, y, w, h)
      ctx.restore()
    } else {
      drawTextLayer(ctx, layer, design, sx, sy)
    }
  }

  if (design.effects.scanlines) {
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,.035)'
    for (let y = 0; y < canvas.height; y += Math.max(3, Math.round(5 * sy))) {
      ctx.fillRect(0, y, canvas.width, 1)
    }
    ctx.restore()
  }

  if (selectedId) {
    const layer = design.layers.find((item) => item.id === selectedId)
    if (layer) {
      ctx.save()
      ctx.strokeStyle = design.palette.accent
      ctx.lineWidth = Math.max(1, 2 * sx)
      ctx.setLineDash([8 * sx, 5 * sx])
      ctx.strokeRect(
        layer.x * design.width * sx,
        layer.y * design.height * sy,
        layer.w * design.width * sx,
        layer.h * design.height * sy,
      )
      ctx.restore()
    }
  }
}

export function CreativeCanvasEditor({
  design, assetUrls, selectedLayerId, onSelectLayer, onUpdateLayer, canvasRef,
}: CreativeCanvasEditorProps) {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({})
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const assetKey = Object.entries(assetUrls).sort(([a], [b]) => a.localeCompare(b)).map(([id, url]) => `${id}:${url}`).join('|')

  useEffect(() => {
    let active = true
    void loadCreativeImages(assetUrls).then((loaded) => {
      if (active) setImages(loaded)
    }).catch(() => undefined)
    return () => { active = false }
    // assetKey captures the exact URL set without re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetKey])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = design.width
    canvas.height = design.height
    renderDesign(canvas, design, images, selectedLayerId)
  }, [design, images, selectedLayerId, canvasRef])

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointerPosition(event)
    const hit = [...design.layers].reverse().find((layer) =>
      point.x >= layer.x && point.x <= layer.x + layer.w && point.y >= layer.y && point.y <= layer.y + layer.h,
    )
    if (!hit) {
      onSelectLayer(null)
      return
    }
    onSelectLayer(hit.id)
    drag.current = { id: hit.id, dx: point.x - hit.x, dy: point.y - hit.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return
    const point = pointerPosition(event)
    const layer = design.layers.find((item) => item.id === drag.current?.id)
    if (!layer) return
    onUpdateLayer(layer.id, {
      x: clamp(point.x - drag.current.dx, SAFE_AREA.left, Math.max(SAFE_AREA.left, SAFE_AREA.right - layer.w)),
      y: clamp(point.y - drag.current.dy, SAFE_AREA.top, Math.max(SAFE_AREA.top, SAFE_AREA.bottom - layer.h)),
    })
  }

  const handlePointerUp = () => { drag.current = null }

  return (
    <canvas
      ref={canvasRef}
      className="cs-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label="Editable poster preview. Drag text, photo or logo elements to reposition them."
    />
  )
}
