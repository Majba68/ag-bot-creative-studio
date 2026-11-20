import { useState } from 'react'
import { ArrowRight, Facebook, Instagram, Mail, MapPin, Phone, Twitter, Youtube } from 'lucide-react'
import { CATEGORIES } from '../types'
import { Link, navigate } from '../router'
import { useStore } from '../store'

export function Newsletter() {
  const { notify } = useStore()
  const [email, setEmail] = useState('')
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      notify('Please enter a valid email address.', 'error')
      return
    }
    try {
      const current = JSON.parse(localStorage.getItem('trapo.newsletter.v1') || '[]') as string[]
      localStorage.setItem('trapo.newsletter.v1', JSON.stringify([...new Set([...current, email])]))
    } catch { /* local storage unavailable */ }
    notify('Saved — welcome to the TRAPO edit (demo subscription).', 'success')
    setEmail('')
  }
  return (
    <section className="newsletter">
      <div className="container newsletter__inner">
        <div>
          <span className="eyebrow eyebrow--light">The TRAPO Edit</span>
          <h2>Good taste, delivered.</h2>
          <p>New arrivals, considered stories and members-only offers. No noise.</p>
        </div>
        <form onSubmit={submit} className="newsletter__form">
          <Mail size={18} />
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your email address" aria-label="Email address" />
          <button type="submit">Subscribe <ArrowRight size={15} /></button>
        </form>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="brand brand--footer">
              <img src="brand/trapo-mascot.jpeg" alt="TRAPO mascot" />
              <span className="brand__word">TRAPO<span className="brand__period">.</span></span>
            </Link>
            <p>Discover your style. Explore everything. A considered destination for modern living — thoughtfully curated, beautifully made.</p>
            <div className="footer-social">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={17} /></a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={17} /></a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter"><Twitter size={17} /></a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube size={17} /></a>
            </div>
          </div>
          <div className="footer-column">
            <h4>Shop</h4>
            {CATEGORIES.slice(0, 5).map((category) => (
              <Link key={category} to={`/shop?category=${encodeURIComponent(category)}`}>{category}</Link>
            ))}
          </div>
          <div className="footer-column">
            <h4>Explore</h4>
            {CATEGORIES.slice(5).map((category) => (
              <Link key={category} to={`/shop?category=${encodeURIComponent(category)}`}>{category}</Link>
            ))}
            <Link to="/collections">Collections</Link>
          </div>
          <div className="footer-column">
            <h4>Support</h4>
            <button type="button" onClick={() => navigate('/about#shipping')}>Shipping & Returns</button>
            <button type="button" onClick={() => navigate('/about#faq')}>FAQ</button>
            <Link to="/admin">Admin Dashboard</Link>
            <button type="button" onClick={() => navigate('/cart')}>Your Bag</button>
          </div>
          <div className="footer-column footer-contact">
            <h4>Visit us</h4>
            <p><MapPin size={15} /> 12 Mercer Street, New York, NY</p>
            <p><Phone size={15} /> +1 (212) 555-0148</p>
            <p><Mail size={15} /> hello@trapo.example</p>
            <div className="footer-payments"><span>VISA</span><span>MC</span><span>AMEX</span><span>PAYPAL</span></div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} TRAPO. All rights reserved.</span>
          <span>Independent demonstration storefront — no real orders or payments are processed.</span>
          <span>Privacy · Terms · Accessibility</span>
        </div>
      </div>
    </footer>
  )
}
