import { useEffect, useState } from 'react'
import { ExternalLink, KeyRound, LockKeyhole, ShieldCheck, X } from 'lucide-react'
import { useApp } from '../state'

export function PlatformModal() {
  const { platformOpen, setPlatformOpen, notify } = useApp()
  const [url, setUrl] = useState(() => localStorage.getItem('agbot-platform') ?? '')

  useEffect(() => {
    if (!platformOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPlatformOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [platformOpen, setPlatformOpen])

  if (!platformOpen) return null

  const open = () => {
    try {
      const parsed = new URL(url.trim())
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Unsupported protocol')
      localStorage.setItem('agbot-platform', parsed.href)
      window.open(parsed.href, '_blank', 'noopener,noreferrer')
      notify('Opening your platform in a new tab. AG BOT does not control or access that account.', 'success')
      setPlatformOpen(false)
    } catch {
      notify('Enter a valid web address beginning with https://', 'error')
    }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={() => setPlatformOpen(false)} />
      <div className="platform-modal" role="dialog" aria-modal="true" aria-label="Connect your trading platform">
        <header className="drawer-head">
          <div className="drawer-brand"><span className="platform-icon"><ExternalLink size={18} /></span><div><strong>Your trading platform</strong><small>Open in a separate tab</small></div></div>
          <button type="button" className="icon-btn" onClick={() => setPlatformOpen(false)} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="platform-body">
          <div className="safety-list">
            <div><ShieldCheck size={17} /><span>You choose the URL. AG BOT does not partner with or endorse any broker.</span></div>
            <div><LockKeyhole size={17} /><span>We never collect or store passwords, session cookies or account credentials.</span></div>
            <div><KeyRound size={17} /><span>No trades are placed automatically. You execute everything yourself.</span></div>
          </div>

          <label className="field-label" htmlFor="platform-url">Platform web address</label>
          <input
            id="platform-url"
            className="select-field"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://your-broker.example.com"
            onKeyDown={(event) => {
              if (event.key === 'Enter') open()
            }}
          />
          <small className="field-hint">Only https:// sites are recommended. Check the address before opening.</small>

          <button type="button" className="btn-primary btn-block" onClick={open}>
            <ExternalLink size={17} /> Open platform in new tab
          </button>
        </div>
      </div>
    </>
  )
}
