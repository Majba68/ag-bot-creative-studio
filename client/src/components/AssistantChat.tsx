import { useEffect, useRef, useState } from 'react'
import { Bot, ImagePlus, Send, Sparkles, X } from 'lucide-react'
import { api } from '../api'
import { useApp } from '../state'
import { Logo } from './Logo'

type Message = { id: number; role: 'user' | 'assistant'; text: string; time: string }

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function AssistantChat() {
  const { assistantOpen, setAssistantOpen, analysis, settings, health, notify } = useApp()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'Hi, I’m the AG BOT assistant. Ask me about technical indicators, the current analysis, or risk management. You can also upload a chart screenshot for observation when a vision model is configured.',
      time: now(),
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (!assistantOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAssistantOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [assistantOpen, setAssistantOpen])

  if (!assistantOpen) return null

  const push = (role: Message['role'], text: string) => {
    setMessages((current) => [...current, { id: Date.now() + Math.random(), role, text, time: now() }])
  }

  const send = async (text: string) => {
    const value = text.trim()
    if (!value || busy) return
    push('user', value)
    setInput('')
    setBusy(true)
    try {
      const response = await api.chat(value, analysis)
      push('assistant', response.text)
      if (!response.available) notify('AI language service is not configured — showing deterministic fallback.', 'info')
    } catch (error) {
      push('assistant', error instanceof Error ? `Request failed: ${error.message}` : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }

  const upload = async () => {
    if (!file || busy) return
    if (file.size > 5 * 1024 * 1024) {
      notify('Images must be 5 MB or smaller.', 'error')
      return
    }
    push('user', `Analyse screenshot: ${file.name}`)
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setBusy(true)
    try {
      const response = await api.vision(file)
      push('assistant', response.text)
      if (!response.available) notify('Vision model is not configured yet.', 'info')
    } catch (error) {
      push('assistant', error instanceof Error ? `Upload failed: ${error.message}` : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const quickPrompts = [
    'Summarise the current analysis',
    'Explain RSI in simple terms',
    'What is support and resistance?',
    'How should I manage risk?',
  ]

  return (
    <>
      <div className="drawer-backdrop" onClick={() => setAssistantOpen(false)} />
      <aside className="assistant-drawer" aria-label="AI trading assistant">
        <header className="drawer-head">
          <div className="drawer-brand"><Logo size={38} animated={false} /><div><strong>AI Assistant</strong><small>{settings.symbol} · {settings.interval}</small></div></div>
          <button type="button" className="icon-btn" onClick={() => setAssistantOpen(false)} aria-label="Close assistant"><X size={18} /></button>
        </header>

        <div className="ai-status">
          <Sparkles size={13} />
          {health?.llmConfigured
            ? `AI service connected (${health.llmProvider}) — answers are grounded in the current analysis.`
            : 'AI service not configured — deterministic answers only. Add LLM keys on the server to enable full chat and vision.'}
        </div>

        <div className="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`chat-row ${message.role}`}>
              {message.role === 'assistant' && <span className="chat-avatar"><Bot size={15} /></span>}
              <div className="chat-bubble">
                <p>{message.text}</p>
                <small>{message.time}</small>
              </div>
            </div>
          ))}
          {busy && <div className="chat-row assistant"><span className="chat-avatar"><Bot size={15} /></span><div className="chat-bubble"><p><span className="typing">···</span></p></div></div>}
          <div ref={endRef} />
        </div>

        <div className="quick-prompts">
          {quickPrompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => void send(prompt)} disabled={busy}>{prompt}</button>
          ))}
        </div>

        <div className="chat-compose">
          <div className="upload-row">
            <button type="button" className="upload-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
              <ImagePlus size={15} /> Attach chart screenshot
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {file && <span className="file-name">{file.name}</span>}
            {file && <button type="button" className="btn-primary btn-tiny" onClick={() => void upload()} disabled={busy}>Analyse</button>}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void send(input)
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about the market or this analysis…"
              rows={2}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send(input)
                }
              }}
            />
            <button type="submit" className="send-btn" disabled={busy || !input.trim()} aria-label="Send message"><Send size={17} /></button>
          </form>
          <small className="chat-note">No trade instructions are executed. Never share passwords or account credentials.</small>
        </div>
      </aside>
    </>
  )
}
