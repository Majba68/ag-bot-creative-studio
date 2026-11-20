import { useEffect, type ReactNode } from 'react'
import { Heart, Minus, Plus, Star, X } from 'lucide-react'
import { Link } from '../router'
import { useStore } from '../store'
import { money } from '../api'
import type { Product } from '../types'

export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <span className={`eyebrow${light ? ' eyebrow--light' : ''}`}>{children}</span>
}

export function SectionHeading({ eyebrow, title, action, light = false }: {
  eyebrow?: string
  title: ReactNode
  action?: ReactNode
  light?: boolean
}) {
  return (
    <div className={`section-heading${light ? ' section-heading--light' : ''}`}>
      <div>
        {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={12} fill={i <= Math.round(rating) ? 'currentColor' : 'none'} strokeWidth={1.4} />
      ))}
      {count !== undefined && <span className="stars__count">({count})</span>}
    </span>
  )
}

export function Price({ product, large = false }: { product: Product; large?: boolean }) {
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
  return (
    <span className={`price${large ? ' price--large' : ''}`}>
      <span className={hasDiscount ? 'price__sale' : ''}>{money(product.price)}</span>
      {hasDiscount && <><s>{money(product.compareAtPrice!)}</s><em>-{product.discountPercent}%</em></>}
    </span>
  )
}

export function QtyStepper({ value, onChange, compact = false }: {
  value: number
  onChange: (value: number) => void
  compact?: boolean
}) {
  return (
    <div className={`qty-stepper${compact ? ' qty-stepper--compact' : ''}`}>
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(value - 1)}><Minus size={14} /></button>
      <span>{value}</span>
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(value + 1)}><Plus size={14} /></button>
    </div>
  )
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, wishlist } = useStore()
  const saved = wishlist.includes(product.id)
  return (
    <article className="product-card">
      <div className="product-card__media">
        <Link to={`/product/${product.id}`} aria-label={product.name}>
          <img src={product.images[0]} alt={product.name} loading="lazy" />
        </Link>
        <div className="product-card__badges">
          {product.isNew && <span className="badge badge--dark">New</span>}
          {product.discountPercent > 0 && <span className="badge badge--accent">-{product.discountPercent}%</span>}
          {product.isBestseller && !product.isNew && <span className="badge badge--dark">Bestseller</span>}
        </div>
        <button
          type="button"
          className={`icon-button product-card__heart${saved ? ' is-active' : ''}`}
          aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={() => toggleWishlist(product.id)}
        ><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button>
        <button
          type="button"
          className="product-card__quick"
          disabled={!product.inStock}
          onClick={() => addToCart(product)}
        >{product.inStock ? 'Quick add' : 'Sold out'}</button>
      </div>
      <div className="product-card__body">
        <span className="product-card__brand">{product.brand}</span>
        <Link to={`/product/${product.id}`} className="product-card__name">{product.name}</Link>
        <Price product={product} />
        <div className="product-card__swatches" aria-label="Available colours">
          {product.colors.slice(0, 4).map((color) => (
            <span key={color.name} title={color.name} style={{ background: color.hex }} />
          ))}
          {product.colors.length > 4 && <small>+{product.colors.length - 4}</small>}
        </div>
      </div>
    </article>
  )
}

export function Modal({ title, children, onClose, wide = false }: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className={`modal${wide ? ' modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__header">
          <h3>{title}</h3>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-state__mark">TRAPO</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function ProductRail({ products, title, eyebrow }: { products: Product[]; title: string; eyebrow?: string }) {
  if (!products.length) return null
  return (
    <section className="section rail-section">
      <div className="container">
        <SectionHeading eyebrow={eyebrow} title={title} action={<Link to="/shop" className="text-link">Shop all <span>→</span></Link>} />
        <div className="product-rail">
          {products.slice(0, 12).map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  )
}
