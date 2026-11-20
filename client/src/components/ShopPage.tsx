import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { CATEGORIES } from '../types'
import { buildQuery, useRoute } from '../router'
import { useStore } from '../store'
import { money } from '../api'
import { EmptyState, ProductCard, SectionHeading } from './UI'

interface Filters {
  q: string
  category: string[]
  brand: string[]
  color: string[]
  size: string[]
  minPrice: string
  maxPrice: string
  sort: string
  inStock: boolean
  onSale: boolean
  collection: string
}

const emptyFilters: Filters = {
  q: '', category: [], brand: [], color: [], size: [], minPrice: '', maxPrice: '',
  sort: 'newest', inStock: false, onSale: false, collection: '',
}

function fromQuery(params: URLSearchParams): Filters {
  const list = (key: string) => (params.get(key) || '').split(',').filter(Boolean)
  return {
    q: params.get('q') || '',
    category: list('category'),
    brand: list('brand'),
    color: list('color'),
    size: list('size'),
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    sort: params.get('sort') || 'newest',
    inStock: params.get('inStock') === 'true',
    onSale: params.get('onSale') === 'true',
    collection: params.get('collection') || '',
  }
}

function FilterGroup({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="filter-group">
      <button type="button" className="filter-group__title" onClick={() => setOpen(!open)} aria-expanded={open}>
        {title}<ChevronDown size={15} className={open ? 'rotate' : ''} />
      </button>
      {open && <div className="filter-group__body">{children}</div>}
    </div>
  )
}

export function ShopPage() {
  const { products, collections } = useStore()
  const route = useRoute()
  const [filters, setFilters] = useState<Filters>(() => fromQuery(route.query))
  const [showFilters, setShowFilters] = useState(false)
  const [visible, setVisible] = useState(12)

  useEffect(() => { setFilters(fromQuery(route.query)); setVisible(12) }, [route.query.toString()])

  const update = (partial: Partial<Filters>) => {
    setFilters((current) => {
      const next = { ...current, ...partial }
      const params = buildQuery('/shop', {
        q: next.q,
        category: next.category.join(','),
        brand: next.brand.join(','),
        color: next.color.join(','),
        size: next.size.join(','),
        minPrice: next.minPrice,
        maxPrice: next.maxPrice,
        sort: next.sort === 'newest' ? null : next.sort,
        inStock: next.inStock,
        onSale: next.onSale,
        collection: next.collection,
      })
      window.history.replaceState({}, '', params)
      return next
    })
    setVisible(12)
  }

  const toggleInList = (key: 'category' | 'brand' | 'color' | 'size', value: string) => {
    const current = filters[key]
    update({ [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] })
  }

  const brands = useMemo(() => [...new Set(products.map((product) => product.brand))].sort(), [products])
  const colors = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach((product) => product.colors.forEach((color) => map.set(color.name, color.hex)))
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [products])
  const sizes = useMemo(() => [...new Set(products.flatMap((product) => product.sizes))].sort(), [products])

  const filtered = useMemo(() => {
    const term = filters.q.trim().toLowerCase()
    const min = filters.minPrice === '' ? -Infinity : Number(filters.minPrice)
    const max = filters.maxPrice === '' ? Infinity : Number(filters.maxPrice)
    const result = products.filter((product) => {
      if (term && !`${product.name} ${product.brand} ${product.category} ${product.description} ${product.tags.join(' ')}`.toLowerCase().includes(term)) return false
      if (filters.category.length && !filters.category.includes(product.category)) return false
      if (filters.brand.length && !filters.brand.some((brand) => brand.toLowerCase() === product.brand.toLowerCase())) return false
      if (filters.color.length && !filters.color.some((color) => product.colors.some((c) => c.name.toLowerCase() === color.toLowerCase()))) return false
      if (filters.size.length && !filters.size.some((size) => product.sizes.includes(size))) return false
      if (product.price < min || product.price > max) return false
      if (filters.inStock && !product.inStock) return false
      if (filters.onSale && product.discountPercent <= 0) return false
      if (filters.collection && product.collection !== filters.collection) return false
      return true
    })
    const sorters: Record<string, (a: typeof result[number], b: typeof result[number]) => number> = {
      newest: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
      popular: (a, b) => b.reviewCount - a.reviewCount,
    }
    return [...result].sort(sorters[filters.sort] || sorters.newest)
  }, [products, filters])

  const activeChips = [
    ...filters.category.map((value) => ({ label: value, clear: () => toggleInList('category', value) })),
    ...filters.brand.map((value) => ({ label: value, clear: () => toggleInList('brand', value) })),
    ...filters.color.map((value) => ({ label: value, clear: () => toggleInList('color', value) })),
    ...filters.size.map((value) => ({ label: `Size ${value}`, clear: () => toggleInList('size', value) })),
    ...(filters.q ? [{ label: `“${filters.q}”`, clear: () => update({ q: '' }) }] : []),
    ...(filters.collection ? [{ label: filters.collection, clear: () => update({ collection: '' }) }] : []),
    ...(filters.inStock ? [{ label: 'In stock', clear: () => update({ inStock: false }) }] : []),
    ...(filters.onSale ? [{ label: 'On sale', clear: () => update({ onSale: false }) }] : []),
    ...(filters.minPrice || filters.maxPrice ? [{ label: `${filters.minPrice || '$0'} – ${filters.maxPrice || '∞'}`, clear: () => update({ minPrice: '', maxPrice: '' }) }] : []),
  ]

  const title = filters.category.length === 1 ? filters.category[0] : filters.q ? `Results for “${filters.q}”` : 'Shop everything'

  return (
    <main className="shop-page">
      <div className="container">
        <div className="shop-intro">
          <span className="eyebrow">The TRAPO Collection</span>
          <h1>{title}</h1>
          <p>Explore considered pieces across nine categories. Filter by what matters to you.</p>
        </div>
        <SectionHeading
          title={<><span className="shop-count">{filtered.length}</span> {filtered.length === 1 ? 'piece' : 'pieces'}</>}
          action={
            <div className="shop-toolbar">
              <button type="button" className="btn btn--outline btn--small mobile-filter-button" onClick={() => setShowFilters(!showFilters)}>
                <SlidersHorizontal size={15} /> Filters
              </button>
              <label className="sort-select">
                <span>Sort by</span>
                <select value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
                  <option value="newest">Newest</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="rating">Top rated</option>
                  <option value="popular">Most popular</option>
                </select>
              </label>
            </div>
          }
        />

        {activeChips.length > 0 && (
          <div className="active-filters">
            {activeChips.map((chip) => (
              <button key={chip.label} type="button" onClick={chip.clear}>{chip.label}<X size={12} /></button>
            ))}
            <button type="button" className="clear-all" onClick={() => update(emptyFilters)}>Clear all</button>
          </div>
        )}

        <div className="shop-layout">
          <aside className={`shop-sidebar${showFilters ? ' is-open' : ''}`}>
            <div className="shop-sidebar__head">
              <strong>Filters</strong>
              <button type="button" onClick={() => update(emptyFilters)}>Reset</button>
              <button type="button" className="icon-button sidebar-close" aria-label="Close filters" onClick={() => setShowFilters(false)}><X size={18} /></button>
            </div>

            <FilterGroup title="Search">
              <input className="field" value={filters.q} onChange={(event) => update({ q: event.target.value })} placeholder="Search products..." />
            </FilterGroup>

            <FilterGroup title="Category">
              <div className="checkbox-list">
                {CATEGORIES.map((category) => (
                  <label key={category}>
                    <input type="checkbox" checked={filters.category.includes(category)} onChange={() => toggleInList('category', category)} />
                    <span>{category}</span>
                    <small>{products.filter((p) => p.category === category).length}</small>
                  </label>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Price">
              <div className="price-filter">
                <label><span>From</span><input className="field" type="number" min="0" placeholder="$0" value={filters.minPrice} onChange={(event) => update({ minPrice: event.target.value })} /></label>
                <span className="price-filter__dash">—</span>
                <label><span>To</span><input className="field" type="number" min="0" placeholder="$∞" value={filters.maxPrice} onChange={(event) => update({ maxPrice: event.target.value })} /></label>
              </div>
              <input className="range" type="range" min="0" max="1500" step="25" value={filters.maxPrice || 1500} onChange={(event) => update({ maxPrice: event.target.value === '1500' ? '' : event.target.value })} />
              <div className="range-labels"><span>$0</span><span>{money(1500)}+</span></div>
            </FilterGroup>

            <FilterGroup title="Brand" defaultOpen={false}>
              <div className="checkbox-list">
                {brands.map((brand) => (
                  <label key={brand}>
                    <input type="checkbox" checked={filters.brand.includes(brand)} onChange={() => toggleInList('brand', brand)} />
                    <span>{brand}</span>
                  </label>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Colour" defaultOpen={false}>
              <div className="checkbox-list checkbox-list--colors">
                {colors.map(([name, hex]) => (
                  <label key={name}>
                    <input type="checkbox" checked={filters.color.includes(name)} onChange={() => toggleInList('color', name)} />
                    <span className="color-dot" style={{ background: hex }} /><span>{name}</span>
                  </label>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Size" defaultOpen={false}>
              <div className="size-filter">
                {sizes.map((size) => (
                  <button key={size} type="button" className={filters.size.includes(size) ? 'is-active' : ''} onClick={() => toggleInList('size', size)}>{size}</button>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Collection" defaultOpen={false}>
              <div className="checkbox-list">
                {collections.map((collection) => (
                  <label key={collection.id}>
                    <input type="radio" name="collection" checked={filters.collection === collection.name} onChange={() => update({ collection: collection.name })} />
                    <span>{collection.name}</span>
                  </label>
                ))}
                {filters.collection && <button type="button" className="text-link" onClick={() => update({ collection: '' })}>Clear collection</button>}
              </div>
            </FilterGroup>

            <FilterGroup title="Availability" defaultOpen={false}>
              <div className="checkbox-list">
                <label><input type="checkbox" checked={filters.inStock} onChange={() => update({ inStock: !filters.inStock })} /><span>In stock only</span></label>
                <label><input type="checkbox" checked={filters.onSale} onChange={() => update({ onSale: !filters.onSale })} /><span>On sale</span></label>
              </div>
            </FilterGroup>
          </aside>

          <div className="shop-results">
            {filtered.length ? (
              <>
                <div className="product-grid">
                  {filtered.slice(0, visible).map((product) => <ProductCard key={product.id} product={product} />)}
                </div>
                {visible < filtered.length && (
                  <div className="load-more"><button type="button" className="btn btn--outline" onClick={() => setVisible(visible + 12)}>Load more pieces</button></div>
                )}
              </>
            ) : (
              <EmptyState
                title="No pieces found"
                text="Try adjusting your filters or searching for something else."
                action={<button type="button" className="btn btn--dark" onClick={() => update(emptyFilters)}>Clear filters</button>}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
