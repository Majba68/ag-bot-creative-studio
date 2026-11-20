import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  STORAGE,
  adminLogin,
  adminSession,
  apiDeleteCollection,
  apiDeleteDemo,
  apiDeleteProduct,
  apiSaveCollection,
  apiSaveProduct,
  apiUploadImage,
  fileToDataUrl,
  getCatalog,
  getMeta,
  saveLocalCollections,
  saveLocalProducts,
  writeLocal,
} from './api'
import type { CartItem, Collection, Product, StoreMeta, Toast } from './types'

interface AddOptions {
  color?: string
  size?: string
  qty?: number
  quiet?: boolean
}

interface AdminApi {
  token: string | null
  authenticated: boolean
  authRequired: boolean
  login: (password: string) => Promise<void>
  logout: () => void
  saveProduct: (product: Product) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  deleteDemo: () => Promise<number>
  saveCollection: (collection: Collection) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  uploadImage: (file: File) => Promise<string>
}

interface StoreValue {
  products: Product[]
  collections: Collection[]
  loading: boolean
  source: 'api' | 'local'
  meta: StoreMeta | null
  refresh: () => Promise<void>
  cart: CartItem[]
  cartCount: number
  cartSubtotal: number
  cartOpen: boolean
  setCartOpen: (open: boolean) => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  addToCart: (product: Product, options?: AddOptions) => void
  setQty: (key: string, qty: number) => void
  removeFromCart: (key: string) => void
  clearCart: () => void
  wishlist: string[]
  toggleWishlist: (id: string) => void
  toasts: Toast[]
  notify: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
  admin: AdminApi
}

const StoreContext = createContext<StoreValue | null>(null)

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'api' | 'local'>('local')
  const [meta, setMeta] = useState<StoreMeta | null>(null)
  const [cart, setCart] = useState<CartItem[]>(() => readStorage<CartItem[]>(STORAGE.cart, []))
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage<string[]>(STORAGE.wishlist, []))
  const [cartOpen, setCartOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE.token))
  const [authRequired, setAuthRequired] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const toastId = useRef(0)

  const dismissToast = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = ++toastId.current
    setToasts((items) => [...items, { id, message, tone }])
    window.setTimeout(() => dismissToast(id), 3600)
  }, [dismissToast])

  const refresh = useCallback(async () => {
    const [catalog, serverMeta] = await Promise.all([getCatalog(), getMeta()])
    setProducts(catalog.products)
    setCollections(catalog.collections)
    setSource(catalog.source)
    setMeta(serverMeta)
    setAuthRequired(serverMeta?.authRequired ?? false)
    if (catalog.source === 'local') {
      saveLocalProducts(catalog.products)
      saveLocalCollections(catalog.collections)
    }
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([getCatalog(), getMeta(), adminSession(token)]).then(([catalog, serverMeta, session]) => {
      if (!alive) return
      setProducts(catalog.products)
      setCollections(catalog.collections)
      setSource(catalog.source)
      setMeta(serverMeta)
      setAuthRequired(serverMeta?.authRequired ?? session.authRequired)
      setAuthenticated(session.authenticated || (!serverMeta?.authRequired && catalog.source === 'local'))
      if (catalog.source === 'local') {
        saveLocalProducts(catalog.products)
        saveLocalCollections(catalog.collections)
      }
      setLoading(false)
    })
    return () => { alive = false }
    // The token is intentionally read once on mount; login updates state directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { writeLocal(STORAGE.cart, cart) }, [cart])
  useEffect(() => { writeLocal(STORAGE.wishlist, wishlist) }, [wishlist])

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart])
  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart])

  const addToCart = useCallback((product: Product, options: AddOptions = {}) => {
    const color = options.color || product.colors[0]?.name || 'Default'
    const size = options.size || product.sizes[0] || 'One Size'
    const qty = Math.max(1, options.qty || 1)
    const key = `${product.id}|${color}|${size}`
    setCart((items) => {
      const found = items.find((item) => item.key === key)
      if (found) return items.map((item) => item.key === key ? { ...item, qty: item.qty + qty } : item)
      return [...items, {
        key,
        productId: product.id,
        name: product.name,
        image: product.images[0] || '',
        price: product.price,
        color,
        size,
        qty,
      }]
    })
    if (!options.quiet) {
      notify(`${product.name} added to your bag`, 'success')
      setCartOpen(true)
    }
  }, [notify])

  const setQty = useCallback((key: string, qty: number) => {
    setCart((items) => qty <= 0
      ? items.filter((item) => item.key !== key)
      : items.map((item) => item.key === key ? { ...item, qty: Math.min(99, qty) } : item))
  }, [])

  const removeFromCart = useCallback((key: string) => {
    setCart((items) => items.filter((item) => item.key !== key))
    notify('Item removed from your bag', 'info')
  }, [notify])

  const clearCart = useCallback(() => setCart([]), [])

  const toggleWishlist = useCallback((id: string) => {
    setWishlist((items) => {
      const exists = items.includes(id)
      notify(exists ? 'Removed from wishlist' : 'Saved to wishlist', 'info')
      return exists ? items.filter((item) => item !== id) : [...items, id]
    })
  }, [notify])

  const syncProducts = useCallback((next: Product[]) => {
    setProducts(next)
    if (source === 'local') saveLocalProducts(next)
  }, [source])

  const syncCollections = useCallback((next: Collection[]) => {
    setCollections(next)
    if (source === 'local') saveLocalCollections(next)
  }, [source])

  const admin: AdminApi = useMemo(() => ({
    token,
    authenticated,
    authRequired,
    async login(password: string) {
      if (source === 'api') {
        const newToken = await adminLogin(password)
        localStorage.setItem(STORAGE.token, newToken)
        setToken(newToken)
        setAuthenticated(true)
      } else {
        // No backend is configured: the dashboard manages browser-local catalog data.
        localStorage.setItem(STORAGE.token, 'local-session')
        setToken('local-session')
        setAuthenticated(true)
      }
      notify('Admin session started', 'success')
    },
    logout() {
      localStorage.removeItem(STORAGE.token)
      setToken(null)
      setAuthenticated(false)
      notify('Admin session ended', 'info')
    },
    async saveProduct(product: Product) {
      if (source === 'api') {
        await apiSaveProduct(product, token)
        await refresh()
      } else {
        const exists = products.some((item) => item.id === product.id)
        syncProducts(exists ? products.map((item) => item.id === product.id ? product : item) : [product, ...products])
      }
      notify(`${product.name} saved`, 'success')
    },
    async deleteProduct(id: string) {
      if (source === 'api') await apiDeleteProduct(id, token)
      syncProducts(products.filter((item) => item.id !== id))
      if (source === 'api') await refresh()
      notify('Product deleted', 'info')
    },
    async deleteDemo() {
      let deleted = 0
      if (source === 'api') {
        deleted = await apiDeleteDemo(token)
        await refresh()
      } else {
        const demoIds = new Set(products.filter((item) => item.isDemo).map((item) => item.id))
        deleted = demoIds.size
        syncProducts(products.filter((item) => !item.isDemo))
        syncCollections(collections.map((collection) => ({
          ...collection,
          productIds: collection.productIds.filter((id) => !demoIds.has(id)),
        })))
      }
      notify(`${deleted} demonstration products removed`, 'success')
      return deleted
    },
    async saveCollection(collection: Collection) {
      if (source === 'api') {
        await apiSaveCollection(collection, token)
        await refresh()
      } else {
        const exists = collections.some((item) => item.id === collection.id)
        syncCollections(exists ? collections.map((item) => item.id === collection.id ? collection : item) : [...collections, collection])
      }
      notify(`${collection.name} saved`, 'success')
    },
    async deleteCollection(id: string) {
      if (source === 'api') await apiDeleteCollection(id, token)
      syncCollections(collections.filter((item) => item.id !== id))
      notify('Collection deleted', 'info')
    },
    async uploadImage(file: File) {
      if (source === 'api') {
        try {
          return await apiUploadImage(file, token)
        } catch {
          // Server upload unavailable — use a data URL so the admin can still work.
        }
      }
      if (file.size > 2_000_000) throw new Error('Local images must be under 2 MB. Connect the backend for larger uploads.')
      return fileToDataUrl(file)
    },
  }), [authenticated, authRequired, collections, notify, products, refresh, source, syncCollections, syncProducts, token])

  return (
    <StoreContext.Provider value={{
      products, collections, loading, source, meta, refresh,
      cart, cartCount, cartSubtotal, cartOpen, setCartOpen,
      searchOpen, setSearchOpen, mobileOpen, setMobileOpen,
      addToCart, setQty, removeFromCart, clearCart,
      wishlist, toggleWishlist, toasts, notify, dismissToast, admin,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}
