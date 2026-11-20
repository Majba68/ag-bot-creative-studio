import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import seedCollections from '../data/seedCollections.json' with { type: 'json' }
import seedProducts from '../data/seedProducts.json' with { type: 'json' }

export type Category =
  | 'Clothing'
  | 'Shoes'
  | 'Gaming'
  | 'Electronics'
  | 'Watches'
  | 'Accessories'
  | 'Bags'
  | 'Lifestyle'
  | 'Sports Products'

export interface Product {
  id: string
  name: string
  category: Category
  brand: string
  price: number
  compareAtPrice: number | null
  discountPercent: number
  description: string
  shortDescription: string
  images: string[]
  colors: { name: string; hex: string }[]
  sizes: string[]
  specifications: { label: string; value: string }[]
  stock: number
  inStock: boolean
  isDemo: boolean
  isNew: boolean
  isBestseller: boolean
  isTrending: boolean
  featured: boolean
  rating: number
  reviewCount: number
  tags: string[]
  createdAt: string
  collection: string | null
}

export interface Collection {
  id: string
  name: string
  slug: string
  description: string
  image: string
  productIds: string[]
  isDemo: boolean
}

export type StorageMode = 'disk' | 'memory'

export const VALID_CATEGORIES: Category[] = [
  'Clothing', 'Shoes', 'Gaming', 'Electronics', 'Watches',
  'Accessories', 'Bags', 'Lifestyle', 'Sports Products',
]

const categorySet = new Set<string>(VALID_CATEGORIES)

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && categorySet.has(value)
}

/** Repo root works both for tsx (src/store) and compiled Node (dist/store). */
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(moduleDir, '../../..')

const dataDir = process.env.VERCEL === '1'
  ? path.join(os.tmpdir(), 'trapo')
  : path.join(repoRoot, 'server', 'data', 'trapo')

const productsFile = path.join(dataDir, 'products.json')
const collectionsFile = path.join(dataDir, 'collections.json')

let storageMode: StorageMode = 'disk'
let productsCache: Product[] | null = null
let collectionsCache: Collection[] | null = null

export const getStorageMode = (): StorageMode => storageMode
export const getDataDir = (): string => dataDir
export const getUploadsDir = (): string => path.join(dataDir, 'uploads')

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(5).toString('hex')}`
}

/* ------------------------------------------------------------------ */
/* Normalization — nothing read from disk is trusted to match the shape */
/* ------------------------------------------------------------------ */

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function str(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function number(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function bool(value: unknown): boolean {
  return value === true || value === 'true'
}

function strings(value: unknown, maxLength = 500, maxItems = 40): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const entry of value) {
    const text = str(entry, maxLength)
    if (text && !result.includes(text)) result.push(text)
    if (result.length >= maxItems) break
  }
  return result
}

function colorPairs(value: unknown): Product['colors'] {
  if (!Array.isArray(value)) return []
  const result: Product['colors'] = []
  for (const entry of value) {
    const item = record(entry)
    result.push({ name: str(item.name, 120), hex: str(item.hex, 60) })
    if (result.length >= 30) break
  }
  return result.filter((entry) => entry.name || entry.hex)
}

function specPairs(value: unknown): Product['specifications'] {
  if (!Array.isArray(value)) return []
  const result: Product['specifications'] = []
  for (const entry of value) {
    const item = record(entry)
    result.push({ label: str(item.label, 120), value: str(item.value, 200) })
    if (result.length >= 30) break
  }
  return result.filter((entry) => entry.label || entry.value)
}

export function calculateDiscount(price: number, compareAtPrice: number | null): number {
  if (compareAtPrice === null || compareAtPrice <= price || price < 0) return 0
  return Math.min(100, Math.max(0, Math.round((1 - price / compareAtPrice) * 100)))
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

export function normalizeProduct(
  value: unknown,
  options: { id?: string; isDemo?: boolean } = {},
): Product | null {
  const input = record(value)
  const name = str(input.name, 200)
  const id = str(input.id, 120) || str(options.id, 120)
  if (!name || !id) return null

  const price = Math.max(0, number(input.price))
  const rawCompare = input.compareAtPrice
  const compareAtPrice = typeof rawCompare === 'number' && Number.isFinite(rawCompare) && rawCompare > 0
    ? rawCompare
    : null
  const stock = Math.max(0, Math.floor(number(input.stock)))
  const createdAt = str(input.createdAt, 60)
  const collection = typeof input.collection === 'string' && input.collection.trim()
    ? str(input.collection, 120)
    : null

  return {
    id,
    name,
    category: isCategory(input.category) ? input.category : 'Lifestyle',
    brand: str(input.brand, 120) || 'TRAPO',
    price,
    compareAtPrice,
    discountPercent: calculateDiscount(price, compareAtPrice),
    description: str(input.description, 4000),
    shortDescription: str(input.shortDescription, 300),
    images: strings(input.images, 1000, 30),
    colors: colorPairs(input.colors),
    sizes: strings(input.sizes, 60, 30),
    specifications: specPairs(input.specifications),
    stock,
    inStock: stock > 0,
    isDemo: options.isDemo ?? bool(input.isDemo),
    isNew: bool(input.isNew),
    isBestseller: bool(input.isBestseller),
    isTrending: bool(input.isTrending),
    featured: bool(input.featured),
    rating: Math.min(5, Math.max(0, number(input.rating))),
    reviewCount: Math.max(0, Math.floor(number(input.reviewCount))),
    tags: strings(input.tags, 80, 40),
    createdAt: createdAt && !Number.isNaN(Date.parse(createdAt))
      ? new Date(createdAt).toISOString()
      : new Date().toISOString(),
    collection,
  }
}

export function normalizeCollection(
  value: unknown,
  options: { id?: string } = {},
): Collection | null {
  const input = record(value)
  const name = str(input.name, 200)
  const id = str(input.id, 120) || str(options.id, 120)
  if (!name || !id) return null

  return {
    id,
    name,
    slug: slugify(str(input.slug, 200)) || slugify(name) || id.toLowerCase(),
    description: str(input.description, 3000),
    image: str(input.image, 1000),
    productIds: strings(input.productIds, 120, 1000),
    isDemo: bool(input.isDemo),
  }
}

/** Build a product from a validated request body; user-created items are never demo data. */
export function makeProduct(input: unknown): Product {
  const normalized = normalizeProduct(input, {
    id: str(record(input).id, 120) || createId('TRP-US'),
    isDemo: false,
  })
  if (!normalized) throw new Error('Invalid product payload.')
  return normalized
}

export function applyProductPatch(existing: Product, patch: unknown): Product {
  const input = record(patch)
  const merged: Record<string, unknown> = { ...existing }
  const editable: Array<keyof Product> = [
    'name', 'category', 'brand', 'price', 'compareAtPrice', 'description',
    'shortDescription', 'images', 'colors', 'sizes', 'specifications', 'stock',
    'isNew', 'isBestseller', 'isTrending', 'featured', 'rating', 'reviewCount',
    'tags', 'collection',
  ]
  for (const key of editable) {
    if (Object.prototype.hasOwnProperty.call(input, key)) merged[key] = input[key]
  }
  const normalized = normalizeProduct(merged, { id: existing.id, isDemo: existing.isDemo })
  // Normalization always recalculates inStock and discountPercent from stock /
  // compareAtPrice / price, so patches cannot leave those fields inconsistent.
  return normalized ?? existing
}

export function makeCollection(input: unknown): Collection {
  const normalized = normalizeCollection(input, {
    id: str(record(input).id, 120) || createId('TRP-COL'),
  })
  if (!normalized) throw new Error('Invalid collection payload.')
  return normalized
}

export function applyCollectionPatch(existing: Collection, patch: unknown): Collection {
  const input = record(patch)
  const merged: Record<string, unknown> = { ...existing }
  const editable: Array<keyof Collection> = ['name', 'slug', 'description', 'image', 'productIds']
  for (const key of editable) {
    if (Object.prototype.hasOwnProperty.call(input, key)) merged[key] = input[key]
  }
  if ('name' in input && !('slug' in input)) merged.slug = slugify(str(input.name, 200))
  const normalized = normalizeCollection(merged, { id: existing.id })
  return normalized ?? existing
}

/* ------------------------------------------------------------------ */
/* JSON file persistence with atomic writes and memory fallback        */
/* ------------------------------------------------------------------ */

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

const seedProductList = toArray(seedProducts)
  .map((entry) => normalizeProduct(entry))
  .filter((entry): entry is Product => entry !== null)

const seedCollectionList = toArray(seedCollections)
  .map((entry) => normalizeCollection(entry))
  .filter((entry): entry is Collection => entry !== null)

async function persistList(file: string, data: unknown[]): Promise<void> {
  if (storageMode === 'memory') return
  try {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
    await fs.writeFile(temporary, JSON.stringify(data, null, 2), 'utf8')
    await fs.rename(temporary, file)
  } catch {
    // Read-only filesystems (and some serverless environments) cannot be
    // written to. Keep serving from the in-memory snapshot instead.
    storageMode = 'memory'
  }
}

async function loadList<T>(
  file: string,
  seed: T[],
  normalize: (value: unknown) => T | null,
  getCache: () => T[] | null,
  setCache: (value: T[]) => void,
): Promise<T[]> {
  const cached = getCache()
  if (cached) return cached

  let data: T[] = []
  let usableFile = false
  try {
    const raw = await fs.readFile(file, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      data = parsed.map(normalize).filter((entry): entry is T => entry !== null)
      // A file full of invalid entries is treated like malformed data.
      usableFile = parsed.length === 0 || data.length > 0
    }
  } catch {
    // Missing or unreadable file: seed below.
  }

  if (!usableFile) {
    data = clone(seed)
    await persistList(file, data)
  }
  setCache(data)
  return data
}

const loadProducts = () => loadList(
  productsFile,
  seedProductList,
  normalizeProduct,
  () => productsCache,
  (value) => { productsCache = value },
)

const loadCollections = () => loadList(
  collectionsFile,
  seedCollectionList,
  normalizeCollection,
  () => collectionsCache,
  (value) => { collectionsCache = value },
)

/** Serializes all read/write access so atomic renames cannot race each other. */
let queue: Promise<unknown> = Promise.resolve()
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task)
  queue = next.then(() => undefined, () => undefined)
  return next
}

export async function getSnapshot(): Promise<{ products: Product[]; collections: Collection[] }> {
  return serialized(async () => ({
    products: clone(await loadProducts()),
    collections: clone(await loadCollections()),
  }))
}

export async function readProducts(): Promise<Product[]> {
  return serialized(async () => clone(await loadProducts()))
}

export async function readCollections(): Promise<Collection[]> {
  return serialized(async () => clone(await loadCollections()))
}

/** Mutate a private copy of products, then atomically persist it. */
export async function mutateProducts<T>(mutator: (draft: Product[]) => T): Promise<T> {
  return serialized(async () => {
    const draft = clone(await loadProducts())
    const result = mutator(draft)
    await persistList(productsFile, draft)
    productsCache = draft
    return result
  })
}

/** Mutate a private copy of collections, then atomically persist it. */
export async function mutateCollections<T>(mutator: (draft: Collection[]) => T): Promise<T> {
  return serialized(async () => {
    const draft = clone(await loadCollections())
    const result = mutator(draft)
    await persistList(collectionsFile, draft)
    collectionsCache = draft
    return result
  })
}

/** Clear demo products and every reference to them from all collections. */
export async function deleteDemoProducts(): Promise<number> {
  return serialized(async () => {
    const products = await loadProducts()
    const collections = await loadCollections()
    const demoIds = new Set(products.filter((product) => product.isDemo).map((product) => product.id))
    const remaining = products.filter((product) => !product.isDemo)
    const cleanedCollections = collections.map((collection) => ({
      ...collection,
      productIds: collection.productIds.filter((id) => !demoIds.has(id)),
    }))

    await persistList(productsFile, remaining)
    await persistList(collectionsFile, cleanedCollections)
    productsCache = remaining
    collectionsCache = cleanedCollections
    return demoIds.size
  })
}
