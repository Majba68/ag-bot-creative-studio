import { useId } from 'react'

export function Robot({ onClick, compact = false }: { onClick?: () => void; compact?: boolean }) {
  const id = useId().replace(/:/g, '')
  const head = `robot-head-${id}`
  const body = `robot-body-${id}`
  const glow = `robot-glow-${id}`

  return (
    <button
      type="button"
      className={`robot${compact ? ' robot--compact' : ''}`}
      onClick={onClick}
      aria-label="Open AI trading assistant"
    >
      <span className="robot-halo" />
      <svg viewBox="0 0 240 250" className="robot-svg" role="img" aria-label="Animated AG BOT assistant robot">
        <defs>
          <linearGradient id={head} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#16233E" />
            <stop offset="100%" stopColor="#0B1020" />
          </linearGradient>
          <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1B2B4D" />
            <stop offset="100%" stopColor="#0D1428" />
          </linearGradient>
          <filter id={glow} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g className="robot-orbit">
          <circle cx="120" cy="120" r="104" fill="none" stroke="rgba(0,200,255,.18)" strokeWidth="1" strokeDasharray="6 12" />
          <circle cx="120" cy="16" r="4" fill="#00C8FF" filter={`url(#${glow})`} />
          <circle cx="224" cy="120" r="3" fill="#8B5CF6" filter={`url(#${glow})`} />
        </g>
        <circle cx="120" cy="122" r="86" fill="rgba(0,200,255,.035)" />

        <g className="robot-float">
          <path d="M120 46 V30" stroke="#00C8FF" strokeWidth="3" strokeLinecap="round" />
          <circle className="robot-antenna" cx="120" cy="25" r="6" fill="#8B5CF6" filter={`url(#${glow})`} />

          <rect x="54" y="48" width="132" height="104" rx="30" fill={`url(#${head})`} stroke="rgba(0,200,255,.55)" strokeWidth="2" />
          <rect x="64" y="58" width="112" height="80" rx="24" fill="#060A14" stroke="rgba(139,92,246,.35)" strokeWidth="1" />
          <path d="M70 68 Q120 46 170 68" fill="none" stroke="rgba(0,200,255,.22)" strokeWidth="1.5" />

          <g className="robot-eyes" filter={`url(#${glow})`}>
            <rect x="84" y="84" width="24" height="14" rx="7" fill="#00C8FF" />
            <rect x="132" y="84" width="24" height="14" rx="7" fill="#00C8FF" />
            <circle cx="96" cy="91" r="3" fill="#EAFBFF" />
            <circle cx="144" cy="91" r="3" fill="#EAFBFF" />
          </g>
          <path d="M104 112 Q120 122 136 112" fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="52" cy="100" r="5" fill="#0F1C34" stroke="#00C8FF" strokeWidth="1.5" />
          <circle cx="188" cy="100" r="5" fill="#0F1C34" stroke="#00C8FF" strokeWidth="1.5" />

          <path d="M92 152 H148 L166 174 H74 Z" fill="#111C33" stroke="rgba(0,200,255,.4)" strokeWidth="1.5" />
          <rect x="66" y="174" width="108" height="56" rx="20" fill={`url(#${body})`} stroke="rgba(139,92,246,.5)" strokeWidth="2" />
          <circle cx="120" cy="202" r="17" fill="#070D1B" stroke="#00C8FF" strokeWidth="2" />
          <path className="robot-core" d="M112 208 L120 193 L128 208 Z" fill="#8B5CF6" filter={`url(#${glow})`} />
          <rect x="28" y="180" width="30" height="42" rx="12" fill="#111C33" stroke="rgba(0,200,255,.35)" />
          <rect x="182" y="180" width="30" height="42" rx="12" fill="#111C33" stroke="rgba(0,200,255,.35)" />
        </g>
      </svg>
      {!compact && <span className="robot-cta">Click to open AI assistant</span>}
    </button>
  )
}
