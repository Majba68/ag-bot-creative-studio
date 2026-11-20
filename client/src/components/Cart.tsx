import { useState } from 'react'
import { ArrowRight, CheckCircle2, Lock, ShieldCheck, Trash2, Truck, X } from 'lucide-react'
import { Link, navigate } from '../router'
import { useStore } from '../store'
import { money } from '../api'
import type { DemoOrder } from '../types'
import { EmptyState, QtyStepper } from './UI'

const shippingCost = (subtotal: number) => subtotal >= 150 || subtotal === 0 ? 0 : 12

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, cartSubtotal, setQty, removeFromCart } = useStore()
  if (!cartOpen) return null
  const shipping = shippingCost(cartSubtotal)
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false) }}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping bag">
        <header>
          <div><span className="eyebrow">Your selection</span><h2>Shopping bag <small>({cart.reduce((sum, item) => sum + item.qty, 0)})</small></h2></div>
          <button type="button" className="icon-button" aria-label="Close bag" onClick={() => setCartOpen(false)}><X size={20} /></button>
        </header>
        {cart.length === 0 ? (
          <div className="cart-drawer__empty">
            <EmptyState title="Your bag is empty" text="Discover something worth keeping." action={<button type="button" className="btn btn--dark" onClick={() => { setCartOpen(false); navigate('/shop') }}>Explore the collection</button>} />
          </div>
        ) : (
          <>
            <div className="shipping-progress">
              <div><Truck size={14} /> {cartSubtotal >= 150 ? 'You unlocked complimentary shipping' : `${money(150 - cartSubtotal)} away from free shipping`}</div>
              <span><i style={{ width: `${Math.min(100, (cartSubtotal / 150) * 100)}%` }} /></span>
            </div>
            <div className="cart-drawer__items">
              {cart.map((item) => (
                <div key={item.key} className="cart-line">
                  <img src={item.image} alt={item.name} />
                  <div className="cart-line__body">
                    <Link to={`/product/${item.productId}`} onClick={() => setCartOpen(false)}>{item.name}</Link>
                    <small>{item.color} · {item.size}</small>
                    <div className="cart-line__bottom">
                      <QtyStepper compact value={item.qty} onChange={(qty) => setQty(item.key, qty)} />
                      <strong>{money(item.price * item.qty)}</strong>
                    </div>
                  </div>
                  <button type="button" className="icon-button cart-line__remove" aria-label="Remove item" onClick={() => removeFromCart(item.key)}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <footer className="cart-drawer__footer">
              <div className="totals-row"><span>Subtotal</span><strong>{money(cartSubtotal)}</strong></div>
              <div className="totals-row"><span>Shipping</span><strong>{shipping ? money(shipping) : 'Complimentary'}</strong></div>
              <div className="totals-row totals-row--grand"><span>Total</span><strong>{money(cartSubtotal + shipping)}</strong></div>
              <button type="button" className="btn btn--dark btn--block" onClick={() => { setCartOpen(false); navigate('/checkout') }}>Continue to checkout <ArrowRight size={15} /></button>
              <button type="button" className="btn btn--ghost btn--block" onClick={() => { setCartOpen(false); navigate('/cart') }}>View bag</button>
              <p className="cart-drawer__note"><Lock size={12} /> Demonstration checkout — no payment is processed.</p>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}

export function CartPage() {
  const { cart, cartSubtotal, setQty, removeFromCart, clearCart } = useStore()
  const shipping = shippingCost(cartSubtotal)
  if (!cart.length) {
    return <main className="container page-pad"><EmptyState title="Your bag is empty" text="Explore nine curated categories and find your next favourite." action={<Link to="/shop" className="btn btn--dark">Start shopping</Link>} /></main>
  }
  return (
    <main className="container page-pad cart-page">
      <span className="eyebrow">Your selection</span>
      <h1 className="page-title">Shopping bag</h1>
      <div className="cart-layout">
        <div className="cart-items">
          <div className="cart-items__head"><span>Product</span><span>Quantity</span><span>Total</span></div>
          {cart.map((item) => (
            <div key={item.key} className="cart-row">
              <div className="cart-row__product">
                <img src={item.image} alt={item.name} />
                <div><Link to={`/product/${item.productId}`}>{item.name}</Link><small>{item.color} · {item.size}</small><strong>{money(item.price)} each</strong></div>
              </div>
              <QtyStepper value={item.qty} onChange={(qty) => setQty(item.key, qty)} />
              <div className="cart-row__total"><strong>{money(item.price * item.qty)}</strong><button type="button" onClick={() => removeFromCart(item.key)}><Trash2 size={14} /> Remove</button></div>
            </div>
          ))}
          <button type="button" className="text-link cart-clear" onClick={clearCart}>Clear bag</button>
        </div>
        <aside className="order-summary">
          <h3>Order summary</h3>
          <div className="totals-row"><span>Subtotal</span><strong>{money(cartSubtotal)}</strong></div>
          <div className="totals-row"><span>Shipping</span><strong>{shipping ? money(shipping) : 'Complimentary'}</strong></div>
          <div className="totals-row totals-row--grand"><span>Total</span><strong>{money(cartSubtotal + shipping)}</strong></div>
          <p className="order-summary__note"><ShieldCheck size={14} /> Taxes calculated at checkout. This is a demonstration store.</p>
          <button type="button" className="btn btn--dark btn--block" onClick={() => navigate('/checkout')}>Proceed to checkout <ArrowRight size={15} /></button>
          <Link to="/shop" className="btn btn--ghost btn--block">Continue shopping</Link>
        </aside>
      </div>
    </main>
  )
}

export function CheckoutPage() {
  const { cart, cartSubtotal, clearCart } = useStore()
  const [order, setOrder] = useState<DemoOrder | null>(null)
  const [method, setMethod] = useState('standard')
  const [form, setForm] = useState({ name: '', email: '', address: '', city: '', zip: '', country: 'United States' })
  const [error, setError] = useState('')
  const shipping = method === 'express' ? 24 : shippingCost(cartSubtotal)
  const total = cartSubtotal + shipping

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const placeOrder = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email) || !form.address.trim() || !form.city.trim() || !form.zip.trim()) {
      setError('Please complete all required fields with a valid email address.')
      return
    }
    const created: DemoOrder = {
      id: `TRP-DEMO-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      items: cart,
      subtotal: cartSubtotal,
      shipping,
      total,
      customer: form,
    }
    try { localStorage.setItem('trapo.order.v1', JSON.stringify(created)) } catch { /* ignore */ }
    setOrder(created)
    clearCart()
    setError('')
  }

  if (order) {
    return (
      <main className="container page-pad checkout-success">
        <CheckCircle2 size={52} />
        <span className="eyebrow">Demo order confirmed</span>
        <h1>Thank you, {order.customer.name.split(' ')[0]}.</h1>
        <p>This is a <strong>demonstration order</strong> saved in your browser. No payment was taken and no goods will be shipped.</p>
        <div className="checkout-success__card">
          <div><span>Reference</span><strong>{order.id}</strong></div>
          <div><span>Items</span><strong>{order.items.reduce((sum, item) => sum + item.qty, 0)}</strong></div>
          <div><span>Delivery</span><strong>{method === 'express' ? 'Express' : 'Standard'}</strong></div>
          <div><span>Total shown</span><strong>{money(order.total)}</strong></div>
        </div>
        <Link to="/shop" className="btn btn--dark">Continue exploring <ArrowRight size={15} /></Link>
      </main>
    )
  }

  if (!cart.length) {
    return <main className="container page-pad"><EmptyState title="Nothing to check out" text="Add a few pieces to your bag first." action={<Link to="/shop" className="btn btn--dark">Shop the collection</Link>} /></main>
  }

  return (
    <main className="container page-pad checkout-page">
      <span className="eyebrow">Almost there</span>
      <h1 className="page-title">Checkout</h1>
      <div className="checkout-notice"><Lock size={15} /> Demonstration checkout — no payment is processed. Do not enter real payment details.</div>
      <form onSubmit={placeOrder} className="checkout-layout">
        <div className="checkout-form">
          <section>
            <h3>Contact</h3>
            <label className="field-label">Full name<input className="field" value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Alex Morgan" /></label>
            <label className="field-label">Email address<input className="field" type="email" value={form.email} onChange={(event) => set('email', event.target.value)} placeholder="alex@example.com" /></label>
          </section>
          <section>
            <h3>Delivery address</h3>
            <label className="field-label">Street address<input className="field" value={form.address} onChange={(event) => set('address', event.target.value)} placeholder="12 Mercer Street" /></label>
            <div className="field-row">
              <label className="field-label">City<input className="field" value={form.city} onChange={(event) => set('city', event.target.value)} placeholder="New York" /></label>
              <label className="field-label">Postal code<input className="field" value={form.zip} onChange={(event) => set('zip', event.target.value)} placeholder="10012" /></label>
            </div>
            <label className="field-label">Country<input className="field" value={form.country} onChange={(event) => set('country', event.target.value)} /></label>
          </section>
          <section>
            <h3>Delivery method</h3>
            <label className={`delivery-option${method === 'standard' ? ' is-active' : ''}`}>
              <input type="radio" name="delivery" checked={method === 'standard'} onChange={() => setMethod('standard')} />
              <span><strong>Standard delivery</strong><small>3–7 business days · complimentary over $150</small></span>
              <b>{shippingCost(cartSubtotal) ? money(shippingCost(cartSubtotal)) : 'Free'}</b>
            </label>
            <label className={`delivery-option${method === 'express' ? ' is-active' : ''}`}>
              <input type="radio" name="delivery" checked={method === 'express'} onChange={() => setMethod('express')} />
              <span><strong>Express delivery</strong><small>1–2 business days</small></span>
              <b>{money(24)}</b>
            </label>
          </section>
          {error && <p className="form-error">{error}</p>}
        </div>
        <aside className="order-summary">
          <h3>Your order</h3>
          <div className="summary-items">
            {cart.map((item) => (
              <div key={item.key}><img src={item.image} alt="" /><span><strong>{item.name}</strong><small>{item.color} · {item.size} · Qty {item.qty}</small></span><b>{money(item.price * item.qty)}</b></div>
            ))}
          </div>
          <div className="totals-row"><span>Subtotal</span><strong>{money(cartSubtotal)}</strong></div>
          <div className="totals-row"><span>Shipping</span><strong>{shipping ? money(shipping) : 'Complimentary'}</strong></div>
          <div className="totals-row totals-row--grand"><span>Total</span><strong>{money(total)}</strong></div>
          <button type="submit" className="btn btn--dark btn--block">Place demo order <ArrowRight size={15} /></button>
          <p className="order-summary__note">By placing this demo order you confirm the information above is illustrative.</p>
        </aside>
      </form>
    </main>
  )
}
