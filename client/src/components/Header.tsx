import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import { CATEGORIES } from '../types'
import { Link, navigate, useRoute } from '../router'
import { useStore } from '../store'
import { money } from '../api'

export function Header() {
  const { cartCount, cartSubtotal, setCartOpen, searchOpen, setSearchOpen, mobileOpen, setMobileOpen, products, wishlist } = useStore()
  const route = useRoute()
  const [scrolled, setScrolled] = useState(false)
  const [megaOpen, setMegaOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMegaOpen(false)
    setMobileOpen(false)
    setSearchOpen(false)
  }, [route.path, route.query.toString(), setMobileOpen, setSearchOpen])

  useEffect(() => {
    if (searchOpen) window.setTimeout(() => searchRef.current?.focus(), 60)
    else setQuery('')
  }, [searchOpen])

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return products.filter((product) =>
      `${product.name} ${product.brand} ${product.category} ${product.tags.join(' ')}`.toLowerCase().includes(term),
    ).slice(0, 7)
  }, [products, query])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const term = query.trim()
    if (term) navigate(`/shop?q=${encodeURIComponent(term)}`)
    else navigate('/shop')
  }

  return (
    <>
      <div className="announcement">
        <span>Complimentary shipping on orders over $150</span>
        <span className="announcement__dot">·</span>
        <span>Demonstration storefront — sample products</span>
      </div>
      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="container site-header__inner">
          <button type="button" className="icon-button mobile-menu-button" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>

          <Link to="/" className="brand" aria-label="TRAPO home">
            <img src="brand/trapo-mascot.jpeg" alt="TRAPO mascot" />
            <span className="brand__word">TRAPO<span className="brand__period">.</span></span>
          </Link>

          <nav className="primary-nav" aria-label="Primary navigation">
            <Link to="/">Home</Link>
            <Link to="/shop">Shop</Link>
            <div className="nav-dropdown" onMouseEnter={() => setMegaOpen(true)} onMouseLeave={() => setMegaOpen(false)}>
              <button type="button" className="nav-dropdown__trigger" onClick={() => setMegaOpen((open) => !open)}>
                Categories <ChevronDown size={13} className={megaOpen ? 'rotate' : ''} />
              </button>
              {megaOpen && (
                <div className="mega-menu">
                  <div className="mega-menu__grid">
                    {CATEGORIES.map((category) => {
                      const example = products.find((product) => product.category === category)
                      return (
                        <Link key={category} to={`/shop?category=${encodeURIComponent(category)}`} className="mega-menu__item">
                          {example && <img src={example.images[0]} alt="" loading="lazy" />}
                          <span>{category}</span>
                        </Link>
                      )
                    })}
                  </div>
                  <div className="mega-menu__footer">
                    <span>Curated for the way you live.</span>
                    <Link to="/shop" className="text-link">Explore everything <ArrowRight size={14} /></Link>
                  </div>
                </div>
              )}
            </div>
            <Link to="/collections">Collections</Link>
            <Link to="/about">Our Story</Link>
          </nav>

          <div className="header-actions">
            <button type="button" className="icon-button" aria-label="Search products" onClick={() => setSearchOpen(true)}><Search size={20} /></button>
            <Link to="/wishlist" className="icon-button desktop-only" aria-label="Wishlist">
              <Heart size={20} />
              {wishlist.length > 0 && <span className="icon-count">{wishlist.length}</span>}
            </Link>
            <Link to="/admin" className="icon-button desktop-only" aria-label="Admin dashboard"><UserRound size={20} /></Link>
            <button type="button" className="icon-button cart-button" aria-label={`Cart with ${cartCount} items`} onClick={() => setCartOpen(true)}>
              <ShoppingBag size={20} />
              {cartCount > 0 && <span className="icon-count">{cartCount}</span>}
            </button>
            <span className="header-cart-total desktop-only">{money(cartSubtotal)}</span>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="mobile-nav">
          <div className="mobile-nav__top">
            <span className="brand__word">TRAPO<span className="brand__period">.</span></span>
            <button type="button" className="icon-button" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={22} /></button>
          </div>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/shop">Shop All</Link>
            <Link to="/collections">Collections</Link>
            <Link to="/about">Our Story</Link>
            <Link to="/wishlist">Wishlist</Link>
            <Link to="/admin">Admin Dashboard</Link>
            <span className="mobile-nav__label">Categories</span>
            {CATEGORIES.map((category) => (
              <Link key={category} to={`/shop?category=${encodeURIComponent(category)}`}>{category}</Link>
            ))}
          </nav>
        </div>
      )}

      {searchOpen && (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search products" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false) }}>
          <div className="search-panel">
            <form onSubmit={submitSearch} className="search-panel__form">
              <Search size={22} />
              <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for products, brands, categories..." />
              <button type="button" className="icon-button" aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={20} /></button>
            </form>
            <div className="search-panel__body">
              {query.trim() ? (
                results.length ? (
                  <>
                    <span className="search-panel__label">Top results</span>
                    {results.map((product) => (
                      <Link key={product.id} to={`/product/${product.id}`} className="search-result">
                        <img src={product.images[0]} alt="" />
                        <span><small>{product.category}</small><strong>{product.name}</strong></span>
                        <b>{money(product.price)}</b>
                      </Link>
                    ))}
                    <button type="button" className="text-link search-panel__all" onClick={() => navigate(`/shop?q=${encodeURIComponent(query.trim())}`)}>
                      View all results <ArrowRight size={14} />
                    </button>
                  </>
                ) : <p className="search-panel__empty">No matches for “{query}”. Try a category like “shoes” or “watches”.</p>
              ) : (
                <>
                  <span className="search-panel__label">Popular searches</span>
                  <div className="search-suggestions">
                    {['Wool coat', 'Sneakers', 'Mechanical watch', 'Gaming headset', 'Leather bag', 'Yoga mat'].map((term) => (
                      <button key={term} type="button" onClick={() => setQuery(term)}>{term}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
