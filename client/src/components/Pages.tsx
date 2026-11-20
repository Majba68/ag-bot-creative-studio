import { ArrowRight, Compass, Heart, Leaf, Sparkles, Truck } from 'lucide-react'
import { Link } from '../router'
import { useStore } from '../store'
import type { Product } from '../types'
import { EmptyState, ProductCard, SectionHeading } from './UI'

export function CollectionsPage() {
  const { collections, products } = useStore()
  return (
    <main className="container page-pad">
      <div className="page-intro">
        <span className="eyebrow">Curated with intent</span>
        <h1 className="page-title">Collections</h1>
        <p>Ready-made edits for every part of your day. Each collection brings together pieces that speak the same language.</p>
      </div>
      <div className="collection-grid collection-grid--all">
        {collections.map((collection, index) => {
          const items = collection.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean)
          return (
            <Link key={collection.id} to={`/collections/${collection.slug}`} className={`collection-card collection-card--${index % 3}`}>
              <div className="collection-card__images">
                {(items.length ? items : products.slice(index * 3, index * 3 + 3)).slice(0, 3).map((product, i) => product && (
                  <img key={`${product.id}-${i}`} src={product.images[i] || product.images[0]} alt="" loading="lazy" />
                ))}
              </div>
              <div className="collection-card__content">
                <span className="eyebrow">{items.length} pieces</span>
                <h3>{collection.name}</h3>
                <p>{collection.description}</p>
                <span className="text-link">Explore edit <ArrowRight size={14} /></span>
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}

export function CollectionDetailPage({ slug }: { slug: string }) {
  const { collections, products } = useStore()
  const collection = collections.find((item) => item.slug === slug)
  if (!collection) return <main className="container page-pad"><EmptyState title="Collection not found" text="Explore all of our curated edits instead." action={<Link to="/collections" className="btn btn--dark">All collections</Link>} /></main>
  const items = collection.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[]
  return (
    <main className="collection-detail">
      <div className="collection-detail__hero">
        <img src={collection.image} alt="" />
        <div className="container">
          <span className="eyebrow eyebrow--light">TRAPO Collection</span>
          <h1>{collection.name}</h1>
          <p>{collection.description}</p>
        </div>
      </div>
      <div className="container page-pad">
        <SectionHeading title={<>{items.length} pieces in this edit</>} action={<Link to="/collections" className="text-link">All collections <ArrowRight size={14} /></Link>} />
        {items.length ? (
          <div className="product-grid">{items.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        ) : (
          <EmptyState title="This edit is being refreshed" text="Browse the full collection in the meantime." action={<Link to="/shop" className="btn btn--dark">Shop all</Link>} />
        )}
      </div>
    </main>
  )
}

export function WishlistPage() {
  const { products, wishlist } = useStore()
  const items = products.filter((product) => wishlist.includes(product.id))
  return (
    <main className="container page-pad">
      <div className="page-intro"><span className="eyebrow">Saved pieces</span><h1 className="page-title">Wishlist</h1><p>Your favourite finds, kept in one place.</p></div>
      {items.length ? (
        <div className="product-grid">{items.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      ) : (
        <EmptyState title="Nothing saved yet" text="Tap the heart on any product to keep it here." action={<Link to="/shop" className="btn btn--dark">Find something you love</Link>} />
      )}
    </main>
  )
}

export function AboutPage() {
  return (
    <main className="about-page">
      <div className="about-hero">
        <div className="container">
          <span className="eyebrow eyebrow--light">About TRAPO</span>
          <h1>Explore everything.<br /><em>Become yourself.</em></h1>
          <p>Discover your style. Explore everything.</p>
        </div>
      </div>
      <div className="container page-pad about-content">
        <div className="about-story">
          <img src="/brand/trapo-mascot.jpeg" alt="TRAPO mascot" />
          <div>
            <span className="eyebrow">Our point of view</span>
            <h2>Curated for real life.</h2>
            <p>TRAPO is an independent, demonstration storefront built around a simple belief: great design should be accessible across every part of life. Our nine categories — from clothing and shoes to gaming, watches and sports — are edited with the same eye for quality, character and quiet detail.</p>
            <p>Our mascot captures the spirit of the brand: curious, playful and always moving forward. You will find it throughout the experience — a reminder that style should never take itself too seriously.</p>
          </div>
        </div>
        <div className="value-grid">
          {[
            { icon: <Sparkles size={22} />, title: 'Considered curation', text: 'Every piece is chosen for design, utility and lasting appeal.' },
            { icon: <Leaf size={22} />, title: 'Responsible thinking', text: 'We favour materials and makers with a lighter footprint.' },
            { icon: <Compass size={22} />, title: 'Nine worlds', text: 'One destination for everything that makes your day yours.' },
            { icon: <Heart size={22} />, title: 'Made for you', text: 'Filters, showcases and edits that help you find your fit.' },
          ].map((value) => (
            <div key={value.title} className="value-card"><span>{value.icon}</span><h3>{value.title}</h3><p>{value.text}</p></div>
          ))}
        </div>
        <div className="about-faq" id="shipping">
          <span className="eyebrow">The practical details</span>
          <h2>Shipping & returns</h2>
          <p>Complimentary standard delivery on demo orders over $150. Standard delivery is otherwise $12 and express is $24. Estimated delivery windows are 3–7 and 1–2 business days respectively. Returns are accepted within 30 days on unworn items.</p>
          <p className="about-faq__note"><Truck size={15} /> This website is a demonstration. No physical products are stored, shipped or returned, and no payments are collected.</p>
        </div>
        <div className="about-faq" id="faq">
          <span className="eyebrow">Good to know</span>
          <h2>Frequently asked questions</h2>
          <div className="faq-list">
            <details><summary>Are the products real?</summary><p>All initial products are clearly labelled demonstration samples with locally generated artwork. The admin dashboard can replace them with your own catalogue and uploaded images.</p></details>
            <details><summary>Where is my order?</summary><p>Demo checkouts create a local confirmation only. No real order is transmitted or fulfilled.</p></details>
            <details><summary>Can I manage the catalogue?</summary><p>Yes. Open the Admin Dashboard from the header, sign in, and add, edit or delete products and collections without touching source code.</p></details>
          </div>
        </div>
      </div>
    </main>
  )
}

export function NotFoundPage() {
  return (
    <main className="container page-pad">
      <EmptyState title="This page wandered off" text="Let's get you back to something good." action={<Link to="/" className="btn btn--dark">Back to home</Link>} />
    </main>
  )
}
