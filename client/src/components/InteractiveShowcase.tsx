import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Grip, MoveRight, ShoppingBag } from 'lucide-react'
import { CATEGORIES, type Category, type Product } from '../types'
import { Link } from '../router'
import { useStore } from '../store'
import { money } from '../api'
import { Eyebrow, Price, Stars } from './UI'

const slug = (category: Category) => category.toLowerCase().replace(/\s+/g, '-')

export function InteractiveShowcase() {
  const { products, addToCart } = useStore()
  const [category, setCategory] = useState<Category>('Clothing')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [minOffset, setMinOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, startX: 0, startOffset: 0, currentOffset: 0, moved: 0 })
  const stepRef = useRef(288)

  const categoryProducts = useMemo(
    () => products.filter((product) => product.category === category),
    [products, category],
  )

  useEffect(() => {
    if (!categoryProducts.length) { setSelectedId(null); return }
    setSelectedId((current) => categoryProducts.some((p) => p.id === current) ? current : categoryProducts[0].id)
    setOffset(0)
  }, [category, categoryProducts])

  const measure = useCallback(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return
    const first = track.querySelector<HTMLElement>('.showcase-card')
    const gap = parseFloat(getComputedStyle(track).columnGap || '28') || 28
    if (first) stepRef.current = first.offsetWidth + gap
    setMinOffset(Math.min(0, viewport.clientWidth - track.scrollWidth))
    setOffset((current) => Math.max(Math.min(0, viewport.clientWidth - track.scrollWidth), Math.min(0, current)))
  }, [])

  useLayoutEffect(() => {
    measure()
    const observer = new ResizeObserver(measure)
    if (viewportRef.current) observer.observe(viewportRef.current)
    if (trackRef.current) observer.observe(trackRef.current)
    return () => observer.disconnect()
  }, [measure, category, categoryProducts.length])

  const goToIndex = useCallback((index: number) => {
    const maxIndex = Math.max(0, categoryProducts.length - 1)
    const clamped = Math.max(0, Math.min(maxIndex, index))
    setOffset(-clamped * stepRef.current)
    setSelectedId(categoryProducts[clamped]?.id ?? null)
  }, [categoryProducts])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, a')) return
    drag.current = { active: true, startX: event.clientX, startOffset: offset, currentOffset: offset, moved: 0 }
    setDragging(true)
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* synthetic events may not support capture */ }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    const delta = event.clientX - drag.current.startX
    drag.current.moved = Math.max(drag.current.moved, Math.abs(delta))
    const next = Math.max(minOffset, Math.min(0, drag.current.startOffset + delta))
    drag.current.currentOffset = next
    setOffset(next)
  }

  const endDrag = () => {
    if (!drag.current.active) return
    drag.current.active = false
    setDragging(false)
    if (drag.current.moved > 8) {
      const index = Math.round(-drag.current.currentOffset / stepRef.current)
      goToIndex(index)
    }
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const onWheel = (event: WheelEvent) => {
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey
      if (!horizontal) return
      event.preventDefault()
      const delta = event.deltaX || event.deltaY
      setOffset((current) => Math.max(minOffset, Math.min(0, current - delta)))
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [minOffset])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); goToIndex(Math.round(-offset / stepRef.current) + 1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goToIndex(Math.round(-offset / stepRef.current) - 1) }
  }

  const selected = categoryProducts.find((product) => product.id === selectedId) || categoryProducts[0]
  const selectedIndex = selected ? categoryProducts.findIndex((product) => product.id === selected.id) : 0

  const pickProduct = (product: Product, index: number) => {
    if (drag.current.moved > 8) return
    setSelectedId(product.id)
    goToIndex(index)
  }

  return (
    <section className="showcase-section" id="showcase">
      <div className="container">
        <div className="showcase-head">
          <div>
            <Eyebrow light>Interactive Showcase</Eyebrow>
            <h2>Find your <em>next favourite.</em></h2>
            <p>Drag to explore. Select a piece to see the detail.</p>
          </div>
          <div className="showcase-controls">
            <button type="button" aria-label="Previous product" onClick={() => goToIndex(selectedIndex - 1)}><ArrowLeft size={18} /></button>
            <button type="button" aria-label="Next product" onClick={() => goToIndex(selectedIndex + 1)}><ArrowRight size={18} /></button>
          </div>
        </div>

        <div className="category-tabs" role="tablist" aria-label="Product categories">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={item === category}
              className={item === category ? 'is-active' : ''}
              onClick={() => setCategory(item)}
            >{item}</button>
          ))}
        </div>
      </div>

      <div className={`showcase-stage scene-${slug(category)}`} key={category}>
        <div className="stage-ambient" />
        <div className="stage-fixture" aria-hidden="true">
          {category === 'Clothing' && <><span className="fixture-rail" /><span className="fixture-post fixture-post--left" /><span className="fixture-post fixture-post--right" /></>}
          {(category === 'Shoes' || category === 'Sports Products') && <><span className="fixture-shelf" /><span className="fixture-shelf fixture-shelf--low" /></>}
          {category === 'Gaming' && <><span className="fixture-glow" /><span className="fixture-shelf" /></>}
          {(category === 'Electronics' || category === 'Watches') && <><span className="fixture-pedestal" /><span className="fixture-pedestal fixture-pedestal--wide" /></>}
          {(category === 'Accessories' || category === 'Bags' || category === 'Lifestyle') && <><span className="fixture-rail" /><span className="fixture-shelf" /></>}
        </div>

        {categoryProducts.length ? (
          <div
            ref={viewportRef}
            className={`showcase-viewport${dragging ? ' is-dragging' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            tabIndex={0}
            role="region"
            aria-label={`Drag to browse ${category} products`}
          >
            <div ref={trackRef} className="showcase-track" style={{ transform: `translate3d(${offset}px,0,0)` }}>
              {categoryProducts.map((product, index) => (
                <article
                  key={product.id}
                  className={`showcase-card${product.id === selected?.id ? ' is-selected' : ''}`}
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <button
                    type="button"
                    className="showcase-card__hit"
                    aria-label={`Select ${product.name}`}
                    onClick={() => pickProduct(product, index)}
                  >
                    {category === 'Clothing' && <span className="hanger" aria-hidden="true" />}
                    <span className="showcase-card__image"><img src={product.images[0]} alt={product.name} draggable={false} loading={index < 4 ? 'eager' : 'lazy'} /></span>
                    <span className="showcase-card__caption">
                      <small>{product.brand}</small>
                      <strong>{product.name}</strong>
                      <b>{money(product.price)}</b>
                    </span>
                  </button>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="showcase-empty">No products in this category yet. Add some in the admin dashboard.</p>
        )}
      </div>

      <div className="container">
        <div className="showcase-hint"><Grip size={14} /> Drag horizontally <MoveRight size={14} /> tap a product to explore</div>
      </div>

      <div className="container">
        {selected && (
          <div className="showcase-detail" key={selected.id}>
            <div className="showcase-detail__image">
              <img src={selected.images[1] || selected.images[0]} alt={selected.name} />
              {selected.discountPercent > 0 && <span className="badge badge--accent">-{selected.discountPercent}%</span>}
            </div>
            <div className="showcase-detail__content">
              <Eyebrow>{selected.category} · {selected.brand}</Eyebrow>
              <h3>{selected.name}</h3>
              <Stars rating={selected.rating} count={selected.reviewCount} />
              <Price product={selected} large />
              <p>{selected.description}</p>
              <div className="showcase-detail__colors">
                {selected.colors.map((color) => (
                  <span key={color.name} title={color.name} style={{ background: color.hex }} />
                ))}
                <small>{selected.colors.map((color) => color.name).join(' · ')}</small>
              </div>
              <div className="showcase-detail__actions">
                <button type="button" className="btn btn--dark" onClick={() => addToCart(selected)}>
                  <ShoppingBag size={16} /> Add to bag
                </button>
                <Link to={`/product/${selected.id}`} className="btn btn--outline">View details <ArrowRight size={15} /></Link>
              </div>
            </div>
            <div className="showcase-detail__index">
              <span>{String(selectedIndex + 1).padStart(2, '0')}</span>
              <i />
              <span>{String(categoryProducts.length).padStart(2, '0')}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
