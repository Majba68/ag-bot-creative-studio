export const CATEGORIES = [
  'Clothing',
  'Shoes',
  'Gaming',
  'Electronics',
  'Watches',
  'Accessories',
  'Bags',
  'Lifestyle',
  'Sports Products',
] as const

export type Category = (typeof CATEGORIES)[number]

export interface ProductColor {
  name: string
  hex: string
}

export interface Specification {
  label: string
  value: string
}

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
  colors: ProductColor[]
  sizes: string[]
  specifications: Specification[]
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

export interface CartItem {
  key: string
  productId: string
  name: string
  image: string
  price: number
  color: string
  size: string
  qty: number
}

export interface StoreMeta {
  ok: boolean
  authRequired: boolean
  storageMode: 'file' | 'memory' | 'local'
  productCount: number
  collectionCount: number
  demoCount: number
  version: string
}

export interface Toast {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

export interface DemoOrder {
  id: string
  createdAt: string
  items: CartItem[]
  subtotal: number
  shipping: number
  total: number
  customer: { name: string; email: string; address: string; city: string; zip: string; country: string }
}

export interface CatalogResponse {
  products: Product[]
  collections: Collection[]
  source: 'api' | 'local'
}
