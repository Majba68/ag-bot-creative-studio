import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import {
  authRequired,
  isAuthenticated,
  issueAdminToken,
  requireAdmin,
  verifyPassword,
} from '../store/auth.js'
import {
  applyCollectionPatch,
  applyProductPatch,
  deleteDemoProducts,
  getSnapshot,
  getStorageMode,
  getUploadsDir,
  isCategory,
  makeCollection,
  makeProduct,
  mutateCollections,
  mutateProducts,
  type Product,
} from '../store/store.js'

const router = Router()
export const storeRouter = router

const MAX_JSON_BODY = 256 * 1024
const MAX_LOGIN_BODY = 1024

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
}

const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
}

/* ------------------------------------------------------------------ */
/* Small request helpers                                                */
/* ------------------------------------------------------------------ */

function objectField(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function queryText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim()
  return null
}

function queryBoolean(value: unknown): boolean | null {
  const raw = queryText(value)?.toLowerCase()
  if (raw === 'true' || raw === '1' || raw === 'yes') return true
  if (raw === 'false' || raw === '0' || raw === 'no') return false
  return null
}

function queryInteger(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback
}

function bodyTooLarge(req: Request, max = MAX_JSON_BODY): boolean {
  try {
    return Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8') > max
  } catch {
    return true
  }
}

function badRequest(res: Response, error: string): void {
  res.status(400).json({ error })
}

function notFound(res: Response, error: string): void {
  res.status(404).json({ error })
}

/** All handlers are guarded so persistence or parsing failures never crash the API. */
function route(
  handler: (req: Request, res: Response) => Promise<void> | void,
  errorMessage: string,
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error('[TRAPO Store]', error instanceof Error ? error.message : 'unknown error')
      if (!res.headersSent) res.status(500).json({ error: errorMessage })
    }
  }
}

/* ------------------------------------------------------------------ */
/* Uploads                                                              */
/* ------------------------------------------------------------------ */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 4, parts: 4 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.toLowerCase().startsWith('image/')) {
      callback(new Error('Only image files are allowed.'))
      return
    }
    callback(null, true)
  },
})

function singleImage(req: Request, res: Response, next: NextFunction): void {
  upload.single('image')(req, res, (error) => {
    if (error) {
      const multerError = error instanceof Error && error.name === 'MulterError'
      const code = multerError ? (error as Error & { code?: string }).code : undefined
      const message = code === 'LIMIT_FILE_SIZE'
        ? 'Image must be 8MB or smaller.'
        : error instanceof Error ? error.message : 'Invalid upload.'
      badRequest(res, message.slice(0, 200))
      return
    }
    next()
  })
}

/* ------------------------------------------------------------------ */
/* Meta and admin session                                               */
/* ------------------------------------------------------------------ */

router.get('/meta', route(async (_req, res) => {
  const { products, collections } = await getSnapshot()
  res.json({
    ok: true,
    authRequired,
    storageMode: getStorageMode(),
    productCount: products.length,
    collectionCount: collections.length,
    demoCount: products.filter((product) => product.isDemo).length,
    version: '1.0.0',
  })
}, 'Unable to read store metadata.'))

router.post('/admin/login', route(async (req, res) => {
  if (bodyTooLarge(req, MAX_LOGIN_BODY)) {
    badRequest(res, 'Request body is too large.')
    return
  }
  const password = objectField(req.body).password
  if (authRequired && !verifyPassword(password)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  res.json(issueAdminToken())
}, 'Unable to sign in.'))

router.get('/admin/session', route(async (req, res) => {
  res.json({ authenticated: isAuthenticated(req), authRequired })
}, 'Unable to read the admin session.'))

/* ------------------------------------------------------------------ */
/* Products                                                             */
/* ------------------------------------------------------------------ */

function matchesQuery(product: Product, needle: string): boolean {
  return [
    product.name, product.brand, product.category, product.description,
    product.shortDescription, ...product.tags,
  ].join(' ').toLowerCase().includes(needle)
}

router.get('/products', route(async (req, res) => {
  const { products } = await getSnapshot()
  const needle = queryText(req.query.q)?.toLowerCase() ?? null
  const category = queryText(req.query.category)?.toLowerCase() ?? null
  const brand = queryText(req.query.brand)?.toLowerCase() ?? null
  const color = queryText(req.query.color)?.toLowerCase() ?? null
  const size = queryText(req.query.size)?.toLowerCase() ?? null
  const minPrice = queryText(req.query.minPrice)
  const maxPrice = queryText(req.query.maxPrice)
  const inStock = queryBoolean(req.query.inStock)
  const onSale = queryBoolean(req.query.onSale)
  const sort = queryText(req.query.sort)?.toLowerCase() ?? 'newest'
  const offset = queryInteger(req.query.offset, 0)
  const limit = queryText(req.query.limit) ? queryInteger(req.query.limit, products.length) : null

  const filtered = products.filter((product) => {
    if (needle && !matchesQuery(product, needle)) return false
    if (category && product.category.toLowerCase() !== category) return false
    if (brand && product.brand.toLowerCase() !== brand) return false
    if (color && !product.colors.some((entry) => entry.name.toLowerCase() === color)) return false
    if (size && !product.sizes.some((entry) => entry.toLowerCase() === size)) return false
    if (minPrice !== null && product.price < Number(minPrice)) return false
    if (maxPrice !== null && product.price > Number(maxPrice)) return false
    if (inStock !== null && product.inStock !== inStock) return false
    if (onSale !== null && (product.discountPercent > 0) !== onSale) return false
    return true
  })

  const sorted = [...filtered]
  switch (sort) {
    case 'price-asc':
      sorted.sort((a, b) => a.price - b.price)
      break
    case 'price-desc':
      sorted.sort((a, b) => b.price - a.price)
      break
    case 'rating':
      sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
      break
    default:
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  const paged = limit === null ? sorted.slice(offset) : sorted.slice(offset, offset + limit)
  res.json({ products: paged, total: filtered.length })
}, 'Unable to load products.'))

router.post('/products', requireAdmin, route(async (req, res) => {
  if (bodyTooLarge(req)) {
    badRequest(res, 'Request body is too large.')
    return
  }
  const body = objectField(req.body)
  if (!text(body.name, 200)) {
    badRequest(res, 'A product name is required.')
    return
  }
  if (!isCategory(body.category)) {
    badRequest(res, 'A valid category is required.')
    return
  }
  const price = numeric(body.price)
  if (price === null || price < 0) {
    badRequest(res, 'A valid price is required.')
    return
  }
  const images = Array.isArray(body.images)
    ? body.images.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []
  if (images.length === 0) {
    badRequest(res, 'At least one product image is required.')
    return
  }

  const product = makeProduct(body)
  const saved = await mutateProducts((draft) => {
    if (draft.some((entry) => entry.id === product.id)) return null
    draft.unshift(product)
    return product
  })
  if (!saved) {
    badRequest(res, 'A product with that id already exists.')
    return
  }
  res.json({ product: saved })
}, 'Unable to create the product.'))

// Must be registered before /products/:id so the literal segment wins.
router.delete('/products/demo', requireAdmin, route(async (_req, res) => {
  const deleted = await deleteDemoProducts()
  res.json({ deleted })
}, 'Unable to delete demo products.'))

router.get('/products/:id', route(async (req, res) => {
  const { products } = await getSnapshot()
  const product = products.find((entry) => entry.id === req.params.id)
  if (!product) {
    notFound(res, 'Product not found.')
    return
  }
  res.json({ product })
}, 'Unable to load the product.'))

router.put('/products/:id', requireAdmin, route(async (req, res) => {
  if (bodyTooLarge(req)) {
    badRequest(res, 'Request body is too large.')
    return
  }
  const patch = objectField(req.body)
  if ('category' in patch && !isCategory(patch.category)) {
    badRequest(res, 'Invalid category.')
    return
  }
  if ('price' in patch && (numeric(patch.price) === null || (numeric(patch.price) ?? 0) < 0)) {
    badRequest(res, 'Invalid price.')
    return
  }
  if ('images' in patch) {
    const images = Array.isArray(patch.images)
      ? patch.images.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : []
    if (images.length === 0) {
      badRequest(res, 'At least one product image is required.')
      return
    }
  }

  const updated = await mutateProducts((draft) => {
    const index = draft.findIndex((entry) => entry.id === req.params.id)
    if (index === -1) return null
    draft[index] = applyProductPatch(draft[index], patch)
    return draft[index]
  })
  if (!updated) {
    notFound(res, 'Product not found.')
    return
  }
  res.json({ product: updated })
}, 'Unable to update the product.'))

router.delete('/products/:id', requireAdmin, route(async (req, res) => {
  const deleted = await mutateProducts((draft) => {
    const index = draft.findIndex((entry) => entry.id === req.params.id)
    if (index === -1) return false
    draft.splice(index, 1)
    return true
  })
  if (!deleted) {
    notFound(res, 'Product not found.')
    return
  }
  res.json({ ok: true })
}, 'Unable to delete the product.'))

/* ------------------------------------------------------------------ */
/* Uploads                                                              */
/* ------------------------------------------------------------------ */

router.post('/upload', requireAdmin, singleImage, route(async (req, res) => {
  if (!req.file) {
    badRequest(res, 'An image file is required.')
    return
  }
  const mimetype = req.file.mimetype.toLowerCase().split(';')[0].trim()
  const originalExtension = path.extname(req.file.originalname).toLowerCase()
  const extension = EXT_TO_MIME[originalExtension] ? originalExtension : MIME_TO_EXT[mimetype]
  if (!extension) {
    badRequest(res, 'Only image files are allowed.')
    return
  }

  const filename = `${randomUUID()}${extension}`
  const uploadsDir = getUploadsDir()
  await fs.mkdir(uploadsDir, { recursive: true })
  await fs.writeFile(path.join(uploadsDir, filename), req.file.buffer)
  res.json({ url: `/api/store/uploads/${filename}` })
}, 'Unable to save the uploaded image.'))

router.get('/uploads/:filename', route(async (req, res) => {
  const filename = req.params.filename
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')
    || path.basename(filename) !== filename) {
    badRequest(res, 'Invalid filename.')
    return
  }
  const mime = EXT_TO_MIME[path.extname(filename).toLowerCase()]
  if (!mime) {
    notFound(res, 'File not found.')
    return
  }
  const fullPath = path.join(getUploadsDir(), filename)
  try {
    await fs.access(fullPath)
  } catch {
    notFound(res, 'File not found.')
    return
  }
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (mime === 'image/svg+xml') {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
  }
  res.type(mime)
  res.sendFile(fullPath)
}, 'Unable to read the requested file.'))

/* ------------------------------------------------------------------ */
/* Collections                                                          */
/* ------------------------------------------------------------------ */

router.get('/collections', route(async (_req, res) => {
  const { collections } = await getSnapshot()
  res.json({ collections })
}, 'Unable to load collections.'))

router.post('/collections', requireAdmin, route(async (req, res) => {
  if (bodyTooLarge(req)) {
    badRequest(res, 'Request body is too large.')
    return
  }
  if (!text(objectField(req.body).name, 200)) {
    badRequest(res, 'A collection name is required.')
    return
  }
  const collection = makeCollection(req.body)
  const saved = await mutateCollections((draft) => {
    if (draft.some((entry) => entry.id === collection.id)) return null
    draft.push(collection)
    return collection
  })
  if (!saved) {
    badRequest(res, 'A collection with that id already exists.')
    return
  }
  res.json({ collection: saved })
}, 'Unable to create the collection.'))

router.put('/collections/:id', requireAdmin, route(async (req, res) => {
  if (bodyTooLarge(req)) {
    badRequest(res, 'Request body is too large.')
    return
  }
  const updated = await mutateCollections((draft) => {
    const index = draft.findIndex((entry) => entry.id === req.params.id)
    if (index === -1) return null
    draft[index] = applyCollectionPatch(draft[index], req.body)
    return draft[index]
  })
  if (!updated) {
    notFound(res, 'Collection not found.')
    return
  }
  res.json({ collection: updated })
}, 'Unable to update the collection.'))

router.delete('/collections/:id', requireAdmin, route(async (req, res) => {
  const deleted = await mutateCollections((draft) => {
    const index = draft.findIndex((entry) => entry.id === req.params.id)
    if (index === -1) return false
    draft.splice(index, 1)
    return true
  })
  if (!deleted) {
    notFound(res, 'Collection not found.')
    return
  }
  res.json({ ok: true })
}, 'Unable to delete the collection.'))
