import { useEffect } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useRoute } from './router'
import { useStore } from './store'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { Home } from './components/Home'
import { ShopPage } from './components/ShopPage'
import { ProductPage } from './components/ProductPage'
import { CartDrawer, CartPage, CheckoutPage } from './components/Cart'
import { AdminPage } from './components/AdminPage'
import { AboutPage, CollectionDetailPage, CollectionsPage, NotFoundPage, WishlistPage } from './components/Pages'

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <img src="brand/trapo-mascot.jpeg" alt="TRAPO" />
      <span className="loading-screen__word">TRAPO<span>.</span></span>
      <p>Discover your style.</p>
      <div className="loading-screen__bar"><i /></div>
    </div>
  )
}

function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          {toast.tone === 'success' ? <CheckCircle2 size={17} /> : toast.tone === 'error' ? <XCircle size={17} /> : <Info size={17} />}
          <span>{toast.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismissToast(toast.id)}><XCircle size={14} /></button>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const route = useRoute()
  const { loading } = useStore()
  const path = route.path

  useEffect(() => {
    if (route.hash) {
      window.setTimeout(() => document.querySelector(route.hash)?.scrollIntoView({ behavior: 'smooth' }), 120)
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
  }, [path, route.hash])

  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'TRAPO — Discover Your Style. Explore Everything.',
      '/shop': 'Shop All — TRAPO',
      '/cart': 'Your Bag — TRAPO',
      '/checkout': 'Checkout — TRAPO',
      '/admin': 'Admin Dashboard — TRAPO',
      '/collections': 'Collections — TRAPO',
      '/about': 'Our Story — TRAPO',
      '/wishlist': 'Wishlist — TRAPO',
    }
    document.title = titles[path] || (path.startsWith('/product/') ? 'Product — TRAPO' : 'TRAPO')
  }, [path])

  if (loading) return <><LoadingScreen /><Toasts /></>

  const isAdmin = path === '/admin'
  let page
  if (path === '/') page = <Home />
  else if (path === '/shop') page = <ShopPage />
  else if (path.startsWith('/product/')) page = <ProductPage id={decodeURIComponent(path.slice('/product/'.length))} />
  else if (path === '/cart') page = <CartPage />
  else if (path === '/checkout') page = <CheckoutPage />
  else if (path === '/admin') page = <AdminPage />
  else if (path === '/collections') page = <CollectionsPage />
  else if (path.startsWith('/collections/')) page = <CollectionDetailPage slug={decodeURIComponent(path.slice('/collections/'.length))} />
  else if (path === '/about') page = <AboutPage />
  else if (path === '/wishlist') page = <WishlistPage />
  else page = <NotFoundPage />

  return (
    <>
      {!isAdmin && <Header />}
      {page}
      {!isAdmin && <Footer />}
      <CartDrawer />
      <Toasts />
    </>
  )
}
