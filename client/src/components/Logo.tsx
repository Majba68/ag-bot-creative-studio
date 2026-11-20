import { useId } from 'react'

export function Logo({ size = 64, animated = true }: { size?: number; animated?: boolean }) {
  const id = useId().replace(/:/g, '')
  const gradient = `ag-gradient-${id}`
  const glow = `ag-glow-${id}`

  return (
    <svg
      className={`ag-logo${animated ? ' ag-logo--animated' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="AG BOT logo"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00C8FF" />
          <stop offset="50%" stopColor="#5B8CFF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polygon
        points="50,5 90,28 90,72 50,95 10,72 10,28"
        fill="rgba(10,18,34,.65)"
        stroke={`url(#${gradient})`}
        strokeWidth="2.4"
        filter={`url(#${glow})`}
      />
      <polygon points="50,15 81,33 81,67 50,85 19,67 19,33" fill="none" stroke="rgba(0,200,255,.22)" strokeWidth="1" />

      <g className="ag-logo-core">
        <path d="M31 66 L50 27 L69 66" fill="none" stroke={`url(#${gradient})`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M39 54 H61" stroke="#00C8FF" strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
        <circle cx="50" cy="27" r="3.6" fill="#00C8FF" filter={`url(#${glow})`} />
        <circle cx="31" cy="66" r="3" fill="#8B5CF6" filter={`url(#${glow})`} />
        <circle cx="69" cy="66" r="3" fill="#8B5CF6" filter={`url(#${glow})`} />
      </g>

      <g className="ag-logo-nodes" fill="#00C8FF" opacity=".7">
        <circle cx="50" cy="12" r="1.8" />
        <circle cx="85" cy="50" r="1.8" />
        <circle cx="15" cy="50" r="1.8" />
      </g>
    </svg>
  )
}
