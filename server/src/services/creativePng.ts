import zlib from 'node:zlib'

type DecodedPng = {
  width: number
  height: number
  /** RGBA, 8-bit, length = width * height * 4. */
  data: Uint8Array
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let value = n
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[n] = value >>> 0
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, checksum])
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

export function decodePng(buffer: Buffer): DecodedPng {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('The uploaded logo is not a valid PNG image.')
  }

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  let palette: Buffer | null = null
  let transparency: Buffer | null = null
  const idat: Buffer[] = []

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const start = offset + 8
    const end = start + length
    if (end + 4 > buffer.length) throw new Error('The uploaded PNG is truncated.')

    const data = buffer.subarray(start, end)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'PLTE') {
      palette = Buffer.from(data)
    } else if (type === 'tRNS') {
      transparency = Buffer.from(data)
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data))
    } else if (type === 'IEND') {
      break
    }
    offset = end + 4
  }

  if (!width || !height || width > 6000 || height > 6000) {
    throw new Error('The logo dimensions are unsupported. Use an image up to 6000 × 6000 pixels.')
  }
  if (bitDepth !== 8 || interlace !== 0 || ![0, 2, 3, 4, 6].includes(colorType)) {
    throw new Error('This PNG format is unsupported. Export the logo as a non-interlaced 8-bit PNG.')
  }
  if (colorType === 3 && !palette) throw new Error('The indexed PNG has no colour palette.')

  const channels = colorType === 0 || colorType === 3 ? 1 : colorType === 4 ? 2 : colorType === 2 ? 3 : 4
  const stride = width * channels
  const raw = zlib.inflateSync(Buffer.concat(idat))
  if (raw.length < height * (stride + 1)) throw new Error('The PNG image data is incomplete.')

  const output = new Uint8Array(width * height * 4)
  let previous = new Uint8Array(stride)
  let cursor = 0

  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor]
    cursor += 1
    const line = new Uint8Array(stride)
    for (let i = 0; i < stride; i += 1) {
      const value = raw[cursor + i]
      const left = i >= channels ? line[i - channels] : 0
      const up = previous[i]
      const upperLeft = i >= channels ? previous[i - channels] : 0
      let restored = value
      if (filter === 1) restored = value + left
      else if (filter === 2) restored = value + up
      else if (filter === 3) restored = value + Math.floor((left + up) / 2)
      else if (filter === 4) restored = value + paeth(left, up, upperLeft)
      else if (filter !== 0) throw new Error('The PNG uses an unsupported scanline filter.')
      line[i] = restored & 0xff
    }
    cursor += stride

    for (let x = 0; x < width; x += 1) {
      const source = x * channels
      const target = (y * width + x) * 4
      let r = 0
      let g = 0
      let b = 0
      let a = 255

      if (colorType === 0) {
        r = g = b = line[source]
      } else if (colorType === 2) {
        r = line[source]; g = line[source + 1]; b = line[source + 2]
      } else if (colorType === 3) {
        const index = line[source]
        r = palette![index * 3] ?? 0
        g = palette![index * 3 + 1] ?? 0
        b = palette![index * 3 + 2] ?? 0
        a = transparency && index < transparency.length ? transparency[index] : 255
      } else if (colorType === 4) {
        r = g = b = line[source]
        a = line[source + 1]
      } else {
        r = line[source]; g = line[source + 1]; b = line[source + 2]; a = line[source + 3]
      }

      output[target] = r
      output[target + 1] = g
      output[target + 2] = b
      output[target + 3] = a
    }
    previous = line
  }

  return { width, height, data: output }
}

export function encodePng(width: number, height: number, data: Uint8Array): Buffer {
  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  header[10] = 0
  header[11] = 0
  header[12] = 0

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 8 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function distance(r: number, g: number, b: number, target: { r: number; g: number; b: number }): number {
  return Math.sqrt((r - target.r) ** 2 + (g - target.g) ** 2 + (b - target.b) ** 2)
}

export function removeLogoBackground(
  buffer: Buffer,
  tolerance = 34,
): { buffer: Buffer; removedPixels: number; width: number; height: number } {
  const png = decodePng(buffer)
  const { width, height, data } = png
  const total = width * height
  const step = Math.max(1, Math.floor(Math.min(width, height) / 160))
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()

  const sample = (index: number) => {
    const offset = index * 4
    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count += 1
    bucket.r += r
    bucket.g += g
    bucket.b += b
    buckets.set(key, bucket)
  }

  for (let x = 0; x < width; x += step) {
    sample(yIndex(0, x, width))
    sample(yIndex(height - 1, x, width))
  }
  for (let y = 0; y < height; y += step) {
    sample(yIndex(y, 0, width))
    sample(yIndex(y, width - 1, width))
  }

  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0]
  if (!dominant) return { buffer, removedPixels: 0, width, height }

  const background = {
    r: dominant.r / dominant.count,
    g: dominant.g / dominant.count,
    b: dominant.b / dominant.count,
  }
  const limit = Math.min(110, Math.max(8, tolerance))
  const removed = new Uint8Array(total)
  const stack = new Int32Array(total)
  let stackSize = 0

  const push = (index: number) => {
    if (removed[index]) return
    const offset = index * 4
    if (data[offset + 3] === 0) return
    if (distance(data[offset], data[offset + 1], data[offset + 2], background) > limit) return
    removed[index] = 1
    stack[stackSize] = index
    stackSize += 1
  }

  for (let x = 0; x < width; x += 1) {
    push(yIndex(0, x, width))
    push(yIndex(height - 1, x, width))
  }
  for (let y = 0; y < height; y += 1) {
    push(yIndex(y, 0, width))
    push(yIndex(y, width - 1, width))
  }

  while (stackSize > 0) {
    stackSize -= 1
    const index = stack[stackSize]
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) push(index - 1)
    if (x < width - 1) push(index + 1)
    if (y > 0) push(index - width)
    if (y < height - 1) push(index + width)
  }

  let removedPixels = 0
  for (let i = 0; i < total; i += 1) {
    if (!removed[i]) continue
    removedPixels += 1
    data[i * 4 + 3] = 0
  }

  if (removedPixels === 0) return { buffer, removedPixels: 0, width, height }

  // Feather only the kept pixels next to removed background. Original RGB is untouched.
  const feathered = new Uint8Array(data)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = yIndex(y, x, width)
      if (removed[index]) continue
      let nearest = 3
      for (let dy = -2; dy <= 2 && nearest > 1; dy += 1) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          const candidate = yIndex(ny, nx, width)
          const ring = Math.max(Math.abs(dx), Math.abs(dy))
          if (removed[candidate] && ring < nearest) nearest = ring
        }
      }
      if (nearest === 1) feathered[index * 4 + 3] = Math.min(feathered[index * 4 + 3], 96)
      else if (nearest === 2) feathered[index * 4 + 3] = Math.min(feathered[index * 4 + 3], 190)
    }
  }

  return { buffer: encodePng(width, height, feathered), removedPixels, width, height }
}

function yIndex(y: number, x: number, width: number): number {
  return y * width + x
}
