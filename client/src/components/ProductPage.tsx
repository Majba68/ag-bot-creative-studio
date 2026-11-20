import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Heart, RotateCcw, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import { Link, navigate } from '../router'
import { useStore } from '../store'
import { EmptyState, Price, ProductCard, Stars } from './UI'

export function ProductPage({ id }: { id: string }) {
  const { products, addToCart, toggleWishlist, wishlist } = useStore()
  const product = products.find((item) => item.id === id)
  const [imageIndex, setImageIndex] = useState(0)
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')
  const [qty, setQty] = useState(1)
  const [open, setOpen] = useState<string | null>('description')

  useEffect(() => {
    setImageIndex(0)
    setColor(product?.colors[0]?.name || '')
    setSize(product?.sizes[0] || '')
    setQty(1)
  }, [product?.id])

  if (!product) {
    return <main className="container page-pad"><EmptyState title="Product not found" text="This piece may have been removed. Explore the full collection instead." action={<Link to="/shop" className="btn btn--dark">Shop all</Link>} /></main>
  }

  const saved = wishlist.includes(product.id)
  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4)
  const images = product.images.length ? product.images : ['/brand/trapo-mascot.jpeg']

  const buyNow = () => {
    addToCart(product, { color, size, qty, quiet: true })
    navigate('/checkout')
  }

  return (
    <main className="product-page">
      <div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link><span>/</span>
          <Link to="/shop">Shop</Link><span>/</span>
          <Link to={`/shop?category=${encodeURIComponent(product.category)}`}>{product.category}</Link><span>/</span>
          <span>{product.name}</span>
        </nav>

        <div className="product-detail">
          <div className="gallery">
            <div className="gallery__thumbs">
              {images.map((image, index) => (
                <button key={`${image}-${index}`} type="button" className={index === imageIndex ? 'is-active' : ''} onClick={() => setImageIndex(index)} aria-label={`View image ${index + 1}`}>
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
            <div className="gallery__main">
              <img src={images[imageIndex]} alt={product.name} />
              <div className="gallery__badges">
                {product.isDemo && <span className="badge badge--outline">Sample product</span>}
                {product.isNew && <span className="badge badge--dark">New</span>}
                {product.discountPercent > 0 && <span className="badge badge--accent">-{product.discountPercent}%</span>}
              </div>
              {images.length > 1 && (
                <div className="gallery__nav">
                  <button type="button" aria-label="Previous image" onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)}><ArrowLeft size={16} /></button>
                  <span>{imageIndex + 1} / {images.length}</span>
                  <button type="button" aria-label="Next image" onClick={() => setImageIndex((imageIndex + 1) % images.length)}><ArrowRight size={16} /></button>
                </div>
              )}
            </div>
          </div>

          <div className="product-info">
            <span className="eyebrow">{product.brand} · {product.category}</span>
            <h1>{product.name}</h1>
            <div className="product-info__meta">
              <Stars rating={product.rating} count={product.reviewCount} />
              <span className="product-info__sku">Ref. {product.id}</span>
            </div>
            <Price product={product} large />
            <p className="product-info__summary">{product.description}</p>

            {product.colors.length > 0 && (
              <div className="variant-group">
                <div className="variant-group__label">Colour <strong>{color}</strong></div>
                <div className="swatches">
                  {product.colors.map((item) => (
                    <button key={item.name} type="button" className={color === item.name ? 'is-active' : ''} title={item.name} aria-label={item.name} onClick={() => setColor(item.name)}>
                      <span style={{ background: item.hex }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes.length > 0 && (
              <div className="variant-group">
                <div className="variant-group__label">Size <strong>{size}</strong></div>
                <div className="size-options">
                  {product.sizes.map((item) => (
                    <button key={item} type="button" className={size === item ? 'is-active' : ''} onClick={() => setSize(item)}>{item}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="purchase-row">
              <div className="qty-stepper qty-stepper--large">
                <button type="button" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                <span>{qty}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => setQty(Math.min(10, qty + 1))}>+</button>
              </div>
              <button type="button" className="btn btn--dark btn--grow" disabled={!product.inStock} onClick={() => addToCart(product, { color, size, qty })}>
                <ShoppingBag size={17} /> {product.inStock ? 'Add to bag' : 'Sold out'}
              </button>
              <button type="button" className={`btn btn--icon${saved ? ' is-active' : ''}`} aria-label="Save to wishlist" onClick={() => toggleWishlist(product.id)}>
                <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
              </button>
            </div>
            <button type="button" className="btn btn--outline buy-now" disabled={!product.inStock} onClick={buyNow}>Buy now — demo checkout <ArrowRight size={15} /></button>

            <div className="stock-note">
              <span className={product.inStock ? 'dot dot--green' : 'dot dot--red'} />
              {product.inStock ? `${product.stock} available — ready to ship` : 'Currently out of stock'}
            </div>
            <div className="product-perks">
              <span><Truck size={16} /> Free shipping over $150</span>
              <span><RotateCcw size={16} /> 30-day returns</span>
              <span><ShieldCheck size={16} /> Secure demo checkout</span>
            </div>

            <div className="accordions">
              {[
                { key: 'description', label: 'Description', content: <p>{product.description}<br /><br />{product.shortDescription} Part of the TRAPO edit — selected for considered design and everyday character.</p> },
                { key: 'specs', label: 'Specifications', content: <dl className="spec-list">{product.specifications.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}<div><dt>Reference</dt><dd>{product.id}</dd></div><div><dt>Availability</dt><dd>{product.inStock ? `In stock (${product.stock})` : 'Out of stock'}</dd></div></dl> },
                { key: 'shipping', label: 'Shipping & returns', content: <p>Complimentary standard delivery on orders over $150. Estimated delivery 3–7 business days. 30-day returns on unworn items with original packaging. This is a demonstration storefront — no physical goods are shipped.</p> },
              ].map((item) => (
                <div key={item.key} className={`accordion${open === item.key ? ' is-open' : ''}`}>
                  <button type="button" onClick={() => setOpen(open === item.key ? null : item.key)}>
                    <span>{item.label}</span><span className="accordion__icon">{open === item.key ? '−' : '+'}</span>
                  </button>
                  {open === item.key && <div className="accordion__body">{item.content}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="section related-section">
            <div className="section-heading">
              <div><span className="eyebrow">You may also like</span><h2>More from {product.category}</h2></div>
              <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="text-link">View category <ArrowRight size={14} /></Link>
            </div>
            <div className="product-grid product-grid--four">
              {related.map((item) => <ProductCard key={item.id} product={item} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
