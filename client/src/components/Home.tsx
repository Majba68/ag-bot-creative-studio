import { ArrowDown, ArrowRight, Sparkles } from 'lucide-react'
import { CATEGORIES } from '../types'
import { Link } from '../router'
import { useStore } from '../store'
import { InteractiveShowcase } from './InteractiveShowcase'
import { Newsletter } from './Footer'
import { Eyebrow, ProductRail, SectionHeading } from './UI'

function Hero() {
  const { products } = useStore()
  const heroProducts = CATEGORIES.slice(0, 4).map((category) => products.find((product) => product.category === category)).filter(Boolean)
  return (
    <section className="hero">
      <div className="hero__grain" />
      <div className="container hero__inner">
        <div className="hero__copy">
          <Eyebrow>New Season · 2026 Collection</Eyebrow>
          <h1>Discover<br />your <em>style.</em></h1>
          <p className="hero__tagline">EXPLORE EVERYTHING.</p>
          <p className="hero__body">Nine curated worlds. One considered destination. From the first layer to the final detail — find pieces that feel unmistakably yours.</p>
          <div className="hero__actions">
            <Link to="/shop" className="btn btn--dark">Explore the collection <ArrowRight size={16} /></Link>
            <a href="#showcase" className="btn btn--ghost">Browse the showcase <ArrowDown size={16} /></a>
          </div>
          <div className="hero__stats">
            <div><strong>09</strong><span>Curated categories</span></div>
            <div><strong>{products.length || '120'}+</strong><span>Considered pieces</span></div>
            <div><strong>24/7</strong><span>Style, on demand</span></div>
          </div>
        </div>
        <div className="hero__visual">
          <div className="hero__halo" />
          <div className="hero__mascot"><img src="brand/trapo-mascot.jpeg" alt="TRAPO mascot" /></div>
          {heroProducts.map((product, index) => product && (
            <div key={product.id} className={`hero__float hero__float--${index + 1}`}>
              <img src={product.images[0]} alt={product.name} />
              <span>{product.category}</span>
            </div>
          ))}
          <span className="hero__seal"><Sparkles size={14} /> CURATED FOR YOU</span>
        </div>
      </div>
      <div className="hero__marquee" aria-hidden="true">
        <div>
          {[...CATEGORIES, ...CATEGORIES].map((category, index) => (
            <span key={`${category}-${index}`}>{category} <i>✦</i></span>
          ))}
        </div>
      </div>
    </section>
  )
}

function CategoryGrid() {
  const { products } = useStore()
  return (
    <section className="section categories-section">
      <div className="container">
        <SectionHeading
          eyebrow="Shop by category"
          title={<>Every part of <em>your world.</em></>}
          action={<Link to="/shop" className="text-link">View all <ArrowRight size={14} /></Link>}
        />
        <div className="category-grid">
          {CATEGORIES.map((category, index) => {
            const example = products.find((product) => product.category === category)
            const count = products.filter((product) => product.category === category).length
            return (
              <Link key={category} to={`/shop?category=${encodeURIComponent(category)}`} className={`category-tile category-tile--${index % 3}`}>
                <div className="category-tile__image">
                  {example && <img src={example.images[0]} alt={category} loading="lazy" />}
                </div>
                <div className="category-tile__body">
                  <span>{String(count).padStart(2, '0')} pieces</span>
                  <h3>{category}</h3>
                  <ArrowRight size={17} />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function CollectionsSection() {
  const { collections, products } = useStore()
  const featured = collections.slice(0, 3)
  if (!featured.length) return null
  return (
    <section className="section collections-section">
      <div className="container">
        <SectionHeading
          eyebrow="Featured collections"
          title={<>Curated, <em>considered, complete.</em></>}
          action={<Link to="/collections" className="text-link">All collections <ArrowRight size={14} /></Link>}
        />
        <div className="collection-grid">
          {featured.map((collection, index) => {
            const items = collection.productIds.map((id) => products.find((product) => product.id === id)).filter(Boolean).slice(0, 3)
            return (
              <Link key={collection.id} to={`/collections/${collection.slug}`} className={`collection-card collection-card--${index}`}>
                <div className="collection-card__images">
                  {(items.length ? items : products.slice(index * 3, index * 3 + 3)).map((product, i) => product && (
                    <img key={`${product.id}-${i}`} src={product.images[i] || product.images[0]} alt="" loading="lazy" />
                  ))}
                </div>
                <div className="collection-card__content">
                  <span className="eyebrow">Collection {String(index + 1).padStart(2, '0')}</span>
                  <h3>{collection.name}</h3>
                  <p>{collection.description}</p>
                  <span className="text-link">Discover <ArrowRight size={14} /></span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Story() {
  return (
    <section className="story-section">
      <div className="container story-section__inner">
        <div className="story-section__visual">
          <div className="story-section__frame"><img src="brand/trapo-mascot.jpeg" alt="The TRAPO mascot" /></div>
          <span className="story-section__caption">The spirit of TRAPO — curious, considered, always in motion.</span>
        </div>
        <div className="story-section__copy">
          <Eyebrow>Our story</Eyebrow>
          <h2>Style is a way of <em>seeing the world.</em></h2>
          <p>TRAPO began with a simple idea: the things we surround ourselves with should be beautiful, useful and built to last. We bring together independent sensibility and everyday practicality across nine categories — so you can move through your day without compromise.</p>
          <p>Every piece in our edit is chosen for its character, its craft and the quiet confidence it brings to the ordinary.</p>
          <Link to="/about" className="btn btn--outline">Meet TRAPO <ArrowRight size={15} /></Link>
        </div>
      </div>
    </section>
  )
}

export function Home() {
  const { products } = useStore()
  const newest = [...products].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  const best = products.filter((product) => product.isBestseller)
  const trending = products.filter((product) => product.isTrending)
  const offers = products.filter((product) => product.discountPercent > 0)
  return (
    <>
      <Hero />
      <InteractiveShowcase />
      <CategoryGrid />
      <ProductRail products={newest} eyebrow="Just landed" title="New arrivals" />
      <CollectionsSection />
      <ProductRail products={best.length ? best : products.slice(10, 20)} eyebrow="Loved by you" title="Best sellers" />
      <div className="editorial-banner">
        <div className="container editorial-banner__inner">
          <span className="eyebrow eyebrow--light">The TRAPO Standard</span>
          <h2>Quality you can feel.<br /><em>Details you notice.</em></h2>
          <Link to="/shop" className="btn btn--light">Shop the edit <ArrowRight size={15} /></Link>
        </div>
      </div>
      <ProductRail products={offers} eyebrow="Limited time" title="Special offers" />
      <ProductRail products={trending} eyebrow="What's hot" title="Trending now" />
      <Story />
      <Newsletter />
    </>
  )
}
