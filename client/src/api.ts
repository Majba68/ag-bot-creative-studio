import type { CatalogResponse, Collection, Product, StoreMeta } from './types'
import seedProducts from './data/seedProducts.json'
import seedCollections from './data/seedCollections.json'

const BASE = new URL('api/store', document.baseURI).href.replace(/\/$/, '')
// GitHub Pages serves only static files. Skip API probes there and use the
// bundled demo catalog instead of producing console 404s.
const STATIC_HOST = typeof window !== 'undefined' && /\.github\.io$/.test(window.location.hostname)
export const STORAGE = {
  products: 'trapo.products.v1',
  collections: 'trapo.collections.v1',
  token: 'trapo.admin.token',
  cart: 'trapo.cart.v1',
  wishlist: 'trapo.wishlist.v1',
  order: 'trapo.order.v1',
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable in private browsing. The in-memory state still works.
  }
}

export function localProducts(): Product[] {
  return read<Product[]>(STORAGE.products, seedProducts as Product[])
}

export function localCollections(): Collection[] {
  return read<Collection[]>(STORAGE.collections, seedCollections as Collection[])
}

export function saveLocalProducts(products: Product[]) {
  writeLocal(STORAGE.products, products)
}

export function saveLocalCollections(collections: Collection[]) {
  writeLocal(STORAGE.collections, collections)
}

async function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Request timed out')), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (STATIC_HOST) throw new Error('Static demo mode')
  const response = await withTimeout(
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(init?.headers || {}),
      },
    }),
  )
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((data as { error?: string }).error || `Request failed (${response.status})`)
  return data as T
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getCatalog(): Promise<CatalogResponse> {
  try {
    const [products, collections] = await Promise.all([
      request<{ products: Product[] }>('/products?limit=1000'),
      request<{ collections: Collection[] }>('/collections'),
    ])
    return { products: products.products, collections: collections.collections, source: 'api' }
  } catch {
    return { products: localProducts(), collections: localCollections(), source: 'local' }
  }
}

export async function getMeta(): Promise<StoreMeta | null> {
  try {
    return await request<StoreMeta>('/meta')
  } catch {
    return null
  }
}

export async function adminLogin(password: string): Promise<string> {
  const result = await request<{ token: string }>('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
  return result.token
}

export async function adminSession(token: string | null): Promise<{ authenticated: boolean; authRequired: boolean }> {
  try {
    return await request<{ authenticated: boolean; authRequired: boolean }>('/admin/session', {
      headers: authHeaders(token),
    })
  } catch {
    return { authenticated: false, authRequired: false }
  }
}

export async function apiSaveProduct(product: Product, token: string | null): Promise<Product> {
  const exists = product.id && !STATIC_HOST && (await fetch(`${BASE}/products/${encodeURIComponent(product.id)}`).then((r) => r.ok).catch(() => false))
  const result = await request<{ product: Product }>(exists ? `/products/${encodeURIComponent(product.id)}` : '/products', {
    method: exists ? 'PUT' : 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(product),
  })
  return result.product
}

export async function apiDeleteProduct(id: string, token: string | null): Promise<void> {
  await request(`/products/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders(token) })
}

export async function apiDeleteDemo(token: string | null): Promise<number> {
  const result = await request<{ deleted: number }>('/products/demo', {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return result.deleted
}

export async function apiSaveCollection(collection: Collection, token: string | null): Promise<Collection> {
  const exists = !STATIC_HOST && (await fetch(`${BASE}/collections/${encodeURIComponent(collection.id)}`).then((r) => r.ok).catch(() => false))
  const result = await request<{ collection: Collection }>(exists ? `/collections/${encodeURIComponent(collection.id)}` : '/collections', {
    method: exists ? 'PUT' : 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(collection),
  })
  return result.collection
}

export async function apiDeleteCollection(id: string, token: string | null): Promise<void> {
  await request(`/collections/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders(token) })
}

export async function apiUploadImage(file: File, token: string | null): Promise<string> {
  const form = new FormData()
  form.append('image', file)
  const result = await request<{ url: string }>('/upload', {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  })
  return result.url
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.readAsDataURL(file)
  })
}

export const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value) || 0)
