import { useEffect, useState } from 'react'
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, Database, Download, ImagePlus, LayoutGrid,
  Lock, LogOut, Package, Pencil, Plus, RefreshCw, Search, Settings as SettingsIcon,
  Trash2, UploadCloud, X,
} from 'lucide-react'
import { CATEGORIES, type Category, type Collection, type Product } from '../types'
import { saveLocalCollections, saveLocalProducts } from '../api'
import seedProducts from '../data/seedProducts.json'
import seedCollections from '../data/seedCollections.json'
import { useStore } from '../store'
import { money } from '../api'
import { Modal } from './UI'

type Tab = 'overview' | 'products' | 'collections' | 'settings'
type ConfirmState = { kind: 'product' | 'demo' | 'collection' | 'reset'; id?: string; name?: string } | null

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const blankProduct = (): Product => ({
  id: '',
  name: '',
  category: 'Clothing',
  brand: 'TRAPO Studio',
  price: 0,
  compareAtPrice: null,
  discountPercent: 0,
  description: '',
  shortDescription: '',
  images: [],
  colors: [{ name: 'Black', hex: '#111111' }],
  sizes: [],
  specifications: [],
  stock: 10,
  inStock: true,
  isDemo: false,
  isNew: true,
  isBestseller: false,
  isTrending: false,
  featured: false,
  rating: 5,
  reviewCount: 0,
  tags: [],
  createdAt: new Date().toISOString(),
  collection: null,
})

function AdminLogin() {
  const { admin, source } = useStore()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true); setError('')
    try { await admin.login(password) } catch (err) { setError(err instanceof Error ? err.message : 'Sign in failed.') }
    finally { setBusy(false) }
  }
  return (
    <main className="admin-login">
      <div className="admin-login__card">
        <img src="brand/trapo-mascot.jpeg" alt="TRAPO mascot" />
        <span className="eyebrow">TRAPO Control</span>
        <h1>Admin dashboard</h1>
        <p>{source === 'api' ? 'Enter the administrator password configured for this store.' : 'No backend is configured. Manage the catalogue in this browser.'}</p>
        <form onSubmit={submit}>
          <label className="field-label">
            Administrator password
            <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoFocus disabled={source === 'local'} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn--dark btn--block" disabled={busy || (source === 'api' && !password)}>
            {busy ? 'Signing in…' : source === 'local' ? 'Enter local demo admin' : 'Sign in'} <Check size={15} />
          </button>
        </form>
        <div className="admin-login__note"><Lock size={14} /> {source === 'api' ? 'Protected by server-side authentication.' : 'Changes are stored in localStorage on this device.'}</div>
        <button type="button" className="text-link" onClick={() => window.location.assign('/')}>← Back to store</button>
      </div>
    </main>
  )
}

function ProductForm({ initial, collections, onSave, onCancel }: {
  initial: Product | null
  collections: Collection[]
  onSave: (product: Product) => Promise<void>
  onCancel: () => void
}) {
  const { admin } = useStore()
  const [draft, setDraft] = useState<Product>(() => initial ? clone(initial) : blankProduct())
  const [sizesText, setSizesText] = useState((initial?.sizes || []).join(', '))
  const [tagsText, setTagsText] = useState((initial?.tags || []).join(', '))
  const [imageUrl, setImageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initial) setDraft(clone(initial))
    setSizesText((initial?.sizes || []).join(', '))
    setTagsText((initial?.tags || []).join(', '))
  }, [initial])

  const set = <K extends keyof Product>(key: K, value: Product[K]) => setDraft((current) => ({ ...current, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim()) { setError('A product name is required.'); return }
    if (!Number.isFinite(draft.price) || draft.price < 0) { setError('Enter a valid price.'); return }
    if (!draft.images.length) { setError('Add at least one image URL or upload an image.'); return }
    const price = Number(draft.price)
    const compare = draft.compareAtPrice === null || draft.compareAtPrice === undefined ? null : Number(draft.compareAtPrice)
    const product: Product = {
      ...draft,
      id: draft.id || `TRP-US-${Date.now().toString(36).toUpperCase()}`,
      name: draft.name.trim(),
      price,
      compareAtPrice: compare && compare > price ? compare : null,
      discountPercent: compare && compare > price ? Math.round((1 - price / compare) * 100) : 0,
      sizes: sizesText.split(',').map((item) => item.trim()).filter(Boolean),
      tags: tagsText.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean),
      stock: Math.max(0, Number(draft.stock) || 0),
      inStock: (Number(draft.stock) || 0) > 0,
      rating: Number(draft.rating) || 5,
      reviewCount: Number(draft.reviewCount) || 0,
      createdAt: draft.createdAt || new Date().toISOString(),
    }
    setBusy(true); setError('')
    try { await onSave(product) } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the product.') }
    finally { setBusy(false) }
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true); setError('')
    try {
      const url = await admin.uploadImage(file)
      set('images', [...draft.images, url])
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.') }
    finally { setBusy(false) }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form__grid">
        <label className="field-label field-label--wide">Product name<input className="field" value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="e.g. Merino Crew Knit" /></label>
        <label className="field-label">Category
          <select className="field" value={draft.category} onChange={(event) => set('category', event.target.value as Category)}>
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label className="field-label">Brand<input className="field" value={draft.brand} onChange={(event) => set('brand', event.target.value)} /></label>
        <label className="field-label">Price ($)<input className="field" type="number" min="0" step="0.01" value={draft.price} onChange={(event) => set('price', Number(event.target.value))} /></label>
        <label className="field-label">Compare-at price ($)<input className="field" type="number" min="0" step="0.01" value={draft.compareAtPrice ?? ''} onChange={(event) => set('compareAtPrice', event.target.value === '' ? null : Number(event.target.value))} /></label>
        <label className="field-label">Stock<input className="field" type="number" min="0" value={draft.stock} onChange={(event) => set('stock', Number(event.target.value))} /></label>
        <label className="field-label">Collection
          <select className="field" value={draft.collection || ''} onChange={(event) => set('collection', event.target.value || null)}>
            <option value="">None</option>
            {collections.map((collection) => <option key={collection.id} value={collection.name}>{collection.name}</option>)}
          </select>
        </label>
        <label className="field-label field-label--wide">Short description<input className="field" value={draft.shortDescription} onChange={(event) => set('shortDescription', event.target.value)} /></label>
        <label className="field-label field-label--wide">Description<textarea className="field" rows={4} value={draft.description} onChange={(event) => set('description', event.target.value)} /></label>
        <label className="field-label">Sizes (comma separated)<input className="field" value={sizesText} onChange={(event) => setSizesText(event.target.value)} placeholder="XS, S, M, L" /></label>
        <label className="field-label">Tags (comma separated)<input className="field" value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="wool, outerwear" /></label>
      </div>

      <div className="admin-form__section">
        <h4>Images</h4>
        <div className="image-url-row">
          <input className="field" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://… or /products/image.svg" />
          <button type="button" className="btn btn--outline btn--small" onClick={() => { if (imageUrl.trim()) { set('images', [...draft.images, imageUrl.trim()]); setImageUrl('') } }}><Plus size={14} /> Add URL</button>
          <label className="btn btn--outline btn--small upload-button"><ImagePlus size={14} /> Upload<input type="file" accept="image/*" hidden onChange={(event) => upload(event.target.files?.[0])} /></label>
        </div>
        <div className="image-preview-list">
          {draft.images.map((image, index) => (
            <div key={`${image}-${index}`}><img src={image} alt="" /><button type="button" aria-label="Remove image" onClick={() => set('images', draft.images.filter((_, i) => i !== index))}><X size={13} /></button></div>
          ))}
          {!draft.images.length && <p className="muted">No images yet. Add a URL or upload a file.</p>}
        </div>
      </div>

      <div className="admin-form__section">
        <div className="admin-form__section-head"><h4>Colours</h4><button type="button" className="text-link" onClick={() => set('colors', [...draft.colors, { name: '', hex: '#C7AD72' }])}><Plus size={13} /> Add colour</button></div>
        {draft.colors.map((color, index) => (
          <div key={index} className="row-fields">
            <input className="field" value={color.name} placeholder="Colour name" onChange={(event) => set('colors', draft.colors.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} />
            <input className="field field--color" type="color" value={color.hex} onChange={(event) => set('colors', draft.colors.map((item, i) => i === index ? { ...item, hex: event.target.value } : item))} />
            <button type="button" className="icon-button" aria-label="Remove colour" onClick={() => set('colors', draft.colors.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div className="admin-form__section">
        <div className="admin-form__section-head"><h4>Specifications</h4><button type="button" className="text-link" onClick={() => set('specifications', [...draft.specifications, { label: '', value: '' }])}><Plus size={13} /> Add spec</button></div>
        {draft.specifications.map((spec, index) => (
          <div key={index} className="row-fields">
            <input className="field" value={spec.label} placeholder="Label (e.g. Material)" onChange={(event) => set('specifications', draft.specifications.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} />
            <input className="field" value={spec.value} placeholder="Value" onChange={(event) => set('specifications', draft.specifications.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} />
            <button type="button" className="icon-button" aria-label="Remove specification" onClick={() => set('specifications', draft.specifications.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div className="admin-form__flags">
        {([['isNew', 'New arrival'], ['isBestseller', 'Bestseller'], ['isTrending', 'Trending'], ['featured', 'Featured']] as const).map(([key, label]) => (
          <label key={key}><input type="checkbox" checked={Boolean(draft[key])} onChange={(event) => set(key, event.target.checked)} /> {label}</label>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}
      <footer className="admin-form__footer">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--dark" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Create product'} <Check size={15} /></button>
      </footer>
    </form>
  )
}

function CollectionForm({ initial, products, onSave, onCancel }: {
  initial: Collection | null
  products: Product[]
  onSave: (collection: Collection) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Collection>(() => initial ? clone(initial) : {
    id: '', name: '', slug: '', description: '', image: '', productIds: [], isDemo: false,
  })
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const matches = products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase())).slice(0, 30)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim()) { setError('A collection name is required.'); return }
    setBusy(true); setError('')
    try {
      await onSave({
        ...draft,
        id: draft.id || `col-${Date.now().toString(36)}`,
        name: draft.name.trim(),
        slug: draft.slug || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        image: draft.image || products.find((product) => draft.productIds.includes(product.id))?.images[0] || 'brand/trapo-mascot.jpeg',
      })
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the collection.') }
    finally { setBusy(false) }
  }
  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form__grid">
        <label className="field-label">Collection name<input className="field" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="field-label">Cover image URL<input className="field" value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} /></label>
        <label className="field-label field-label--wide">Description<textarea className="field" rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      </div>
      <div className="admin-form__section">
        <div className="admin-form__section-head"><h4>Products in this edit</h4><span className="muted">{draft.productIds.length} selected</span></div>
        <input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find products…" />
        <div className="collection-picker">
          {matches.map((product) => (
            <label key={product.id}>
              <input type="checkbox" checked={draft.productIds.includes(product.id)} onChange={() => setDraft({
                ...draft,
                productIds: draft.productIds.includes(product.id) ? draft.productIds.filter((id) => id !== product.id) : [...draft.productIds, product.id],
              })} />
              <img src={product.images[0]} alt="" /><span>{product.name}<small>{product.category}</small></span>
            </label>
          ))}
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <footer className="admin-form__footer">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--dark" disabled={busy}>{busy ? 'Saving…' : 'Save collection'} <Check size={15} /></button>
      </footer>
    </form>
  )
}

export function AdminPage() {
  const { admin, products, collections, source, meta, refresh, notify } = useStore()
  const [tab, setTab] = useState<Tab>('overview')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined)
  const [editingCollection, setEditingCollection] = useState<Collection | null | undefined>(undefined)
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setPage(1) }, [search, tab])

  if (!admin.authenticated) return <AdminLogin />

  const demoCount = products.filter((product) => product.isDemo).length
  const outOfStock = products.filter((product) => !product.inStock).length
  const lowStock = products.filter((product) => product.inStock && product.stock <= 10).length
  const filtered = products.filter((product) => `${product.name} ${product.id} ${product.category} ${product.brand}`.toLowerCase().includes(search.toLowerCase()))
  const perPage = 12
  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const shown = filtered.slice((page - 1) * perPage, page * perPage)

  const runConfirm = async () => {
    if (!confirm) return
    setBusy(true); setError('')
    try {
      if (confirm.kind === 'product' && confirm.id) await admin.deleteProduct(confirm.id)
      if (confirm.kind === 'demo') await admin.deleteDemo()
      if (confirm.kind === 'collection' && confirm.id) await admin.deleteCollection(confirm.id)
      if (confirm.kind === 'reset') {
        saveLocalProducts(seedProducts as Product[])
        saveLocalCollections(seedCollections as Collection[])
        await refresh()
      }
      setConfirm(null)
    } catch (err) { setError(err instanceof Error ? err.message : 'Action failed.') }
    finally { setBusy(false) }
  }

  const exportCatalog = () => {
    const blob = new Blob([JSON.stringify({ products, collections }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = 'trapo-catalog.json'; link.click()
    URL.revokeObjectURL(url)
  }

  const importCatalog = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      const data = JSON.parse(await file.text()) as { products?: Product[]; collections?: Collection[] }
      if (!Array.isArray(data.products)) throw new Error('The file must contain a "products" array.')
      if (source !== 'local') throw new Error('Import is available in local mode. Use the API to bulk import on a configured backend.')
      saveLocalProducts(data.products)
      if (Array.isArray(data.collections)) saveLocalCollections(data.collections)
      await refresh()
      notify(`Imported ${data.products.length} products`, 'success')
    } catch (err) { setError(err instanceof Error ? err.message : 'Import failed.') }
  }

  const nav: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: 'overview', label: 'Overview', icon: <LayoutGrid size={17} /> },
    { key: 'products', label: 'Products', icon: <Package size={17} /> },
    { key: 'collections', label: 'Collections', icon: <LayoutGrid size={17} /> },
    { key: 'settings', label: 'Settings', icon: <SettingsIcon size={17} /> },
  ]

  return (
    <main className="admin-shell">
      <div className="admin-sidebar">
        <button type="button" className="admin-sidebar__brand" onClick={() => window.location.assign('/')}>
          <img src="brand/trapo-mascot.jpeg" alt="" /><span>TRAPO<span>.</span><small>Control</small></span>
        </button>
        <nav>
          {nav.map((item) => (
            <button key={item.key} type="button" className={tab === item.key ? 'is-active' : ''} onClick={() => setTab(item.key)}>{item.icon}{item.label}</button>
          ))}
        </nav>
        <div className="admin-sidebar__foot">
          <span><Database size={14} /> {source === 'api' ? 'Backend connected' : 'Browser-local mode'}</span>
          <button type="button" onClick={() => window.location.assign('/')}>View storefront</button>
          <button type="button" onClick={admin.logout}><LogOut size={14} /> Sign out</button>
        </div>
      </div>

      <div className="admin-main">
        <header className="admin-main__header">
          <div><span className="eyebrow">TRAPO Control</span><h1>{nav.find((item) => item.key === tab)?.label}</h1></div>
          <div className="admin-main__actions">
            {tab === 'products' && <button type="button" className="btn btn--dark btn--small" onClick={() => setEditingProduct(null)}><Plus size={15} /> Add product</button>}
            {tab === 'collections' && <button type="button" className="btn btn--dark btn--small" onClick={() => setEditingCollection(null)}><Plus size={15} /> New collection</button>}
          </div>
        </header>
        {error && <p className="form-error admin-error">{error}</p>}

        {tab === 'overview' && (
          <div className="admin-overview">
            <div className="stat-grid">
              {[
                { label: 'Total products', value: products.length, icon: <Package size={18} /> },
                { label: 'Sample products', value: demoCount, icon: <AlertTriangle size={18} /> },
                { label: 'Out of stock', value: outOfStock, icon: <X size={18} /> },
                { label: 'Low stock', value: lowStock, icon: <RefreshCw size={18} /> },
                { label: 'Collections', value: collections.length, icon: <LayoutGrid size={18} /> },
              ].map((stat) => (
                <div key={stat.label} className="stat-card"><span>{stat.icon}</span><strong>{stat.value}</strong><small>{stat.label}</small></div>
              ))}
            </div>
            <div className="admin-panel">
              <div className="admin-panel__head"><h3>Catalogue health</h3><button type="button" className="text-link" onClick={() => setTab('products')}>Manage products <ChevronRight size={14} /></button></div>
              <div className="health-bars">
                <div><span>Products with images</span><i><b style={{ width: `${products.length ? (products.filter((p) => p.images.length).length / products.length) * 100 : 0}%` }} /></i><strong>{products.filter((p) => p.images.length).length}/{products.length}</strong></div>
                <div><span>Products in stock</span><i><b style={{ width: `${products.length ? ((products.length - outOfStock) / products.length) * 100 : 0}%` }} /></i><strong>{products.length - outOfStock}/{products.length}</strong></div>
                <div><span>Demonstration samples</span><i><b style={{ width: `${products.length ? (demoCount / products.length) * 100 : 0}%` }} /></i><strong>{demoCount}/{products.length}</strong></div>
              </div>
            </div>
            <div className="admin-callout">
              <div><span className="eyebrow">Ready for your catalogue?</span><h3>Remove every sample in one action.</h3><p>All {demoCount} automatically generated demonstration products can be removed instantly. Your own products stay untouched.</p></div>
              <button type="button" className="btn btn--outline" disabled={!demoCount} onClick={() => setConfirm({ kind: 'demo' })}>Delete all demonstration products</button>
            </div>
          </div>
        )}

        {tab === 'products' && (
          <div className="admin-panel">
            <div className="admin-table-toolbar">
              <div className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, SKUs, categories…" /></div>
              <span className="muted">{filtered.length} products</span>
              {demoCount > 0 && <button type="button" className="btn btn--outline btn--small" onClick={() => setConfirm({ kind: 'demo' })}>Delete demo products</button>}
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {shown.map((product) => (
                    <tr key={product.id}>
                      <td><div className="admin-product-cell"><img src={product.images[0]} alt="" /><span><strong>{product.name}</strong><small>{product.id}{product.isDemo ? ' · sample' : ''}</small></span></div></td>
                      <td>{product.category}</td>
                      <td>{money(product.price)}{product.discountPercent > 0 && <small className="admin-discount">-{product.discountPercent}%</small>}</td>
                      <td>{product.stock}</td>
                      <td><span className={`status-pill${product.inStock ? ' status-pill--ok' : ''}`}>{product.inStock ? 'In stock' : 'Out of stock'}</span></td>
                      <td><div className="row-actions">
                        <button type="button" className="icon-button" aria-label="Edit product" onClick={() => setEditingProduct(product)}><Pencil size={15} /></button>
                        <button type="button" className="icon-button icon-button--danger" aria-label="Delete product" onClick={() => setConfirm({ kind: 'product', id: product.id, name: product.name })}><Trash2 size={15} /></button>
                      </div></td>
                    </tr>
                  ))}
                  {!shown.length && <tr><td colSpan={6} className="admin-empty">No products match your search.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15} /></button>
              <span>Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={15} /></button>
            </div>
          </div>
        )}

        {tab === 'collections' && (
          <div className="admin-collections">
            {collections.map((collection) => (
              <div key={collection.id} className="admin-collection-card">
                <img src={collection.image} alt="" />
                <div><span className="eyebrow">{collection.productIds.length} products</span><h3>{collection.name}</h3><p>{collection.description}</p></div>
                <div className="row-actions">
                  <button type="button" className="icon-button" aria-label="Edit collection" onClick={() => setEditingCollection(collection)}><Pencil size={15} /></button>
                  <button type="button" className="icon-button icon-button--danger" aria-label="Delete collection" onClick={() => setConfirm({ kind: 'collection', id: collection.id, name: collection.name })}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
            {!collections.length && <div className="admin-panel admin-empty">No collections yet. Create your first edit.</div>}
          </div>
        )}

        {tab === 'settings' && (
          <div className="admin-settings">
            <div className="admin-panel">
              <h3>Store configuration</h3>
              <dl className="settings-list">
                <div><dt>Catalogue source</dt><dd>{source === 'api' ? 'Express API + persistent JSON store' : 'Browser localStorage (no backend configured)'}</dd></div>
                <div><dt>Storage mode</dt><dd>{meta?.storageMode || (source === 'api' ? 'file' : 'local')}</dd></div>
                <div><dt>Admin authentication</dt><dd>{admin.authRequired ? 'Enabled — server password required' : 'Not configured — open local/demo access'}</dd></div>
                <div><dt>Products</dt><dd>{products.length} ({demoCount} demonstration samples)</dd></div>
                <div><dt>Collections</dt><dd>{collections.length}</dd></div>
              </dl>
              <div className="settings-help">
                <h4>To enable a secure backend</h4>
                <p>Set <code>ADMIN_PASSWORD</code> and optionally <code>ADMIN_SECRET</code> in <code>server/.env</code>, then restart the API. Product edits, uploads and images will persist for every visitor. Without these values, the dashboard safely falls back to browser-local data.</p>
              </div>
            </div>
            <div className="admin-panel">
              <h3>Backup & restore</h3>
              <p className="muted">Export your full catalogue as JSON, or import a previously exported catalogue.</p>
              <div className="settings-actions">
                <button type="button" className="btn btn--outline" onClick={exportCatalog}><Download size={15} /> Export catalogue</button>
                <label className="btn btn--outline upload-button"><UploadCloud size={15} /> Import JSON<input type="file" accept="application/json" hidden onChange={(event) => importCatalog(event.target.files?.[0])} /></label>
                {source === 'local' && <button type="button" className="btn btn--outline" onClick={() => setConfirm({ kind: 'reset' })}><RefreshCw size={15} /> Restore sample data</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      {editingProduct !== undefined && (
        <Modal title={editingProduct ? 'Edit product' : 'Add new product'} wide onClose={() => setEditingProduct(undefined)}>
          <ProductForm initial={editingProduct} collections={collections} onSave={async (product) => { await admin.saveProduct(product); setEditingProduct(undefined) }} onCancel={() => setEditingProduct(undefined)} />
        </Modal>
      )}

      {editingCollection !== undefined && (
        <Modal title={editingCollection ? 'Edit collection' : 'New collection'} wide onClose={() => setEditingCollection(undefined)}>
          <CollectionForm initial={editingCollection} products={products} onSave={async (collection) => { await admin.saveCollection(collection); setEditingCollection(undefined) }} onCancel={() => setEditingCollection(undefined)} />
        </Modal>
      )}

      {confirm && (
        <Modal title="Please confirm" onClose={() => setConfirm(null)}>
          <div className="confirm-dialog">
            <AlertTriangle size={30} />
            <p>{confirm.kind === 'demo'
              ? `Delete all ${demoCount} demonstration products? Your own products will remain.`
              : confirm.kind === 'reset'
                ? 'Replace the current browser catalogue with the original sample data? This overwrites local changes.'
                : `Delete “${confirm.name || 'this item'}”? This cannot be undone.`}</p>
            <div className="confirm-dialog__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="btn btn--danger" disabled={busy} onClick={runConfirm}>{busy ? 'Working…' : 'Yes, delete'}</button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  )
}
