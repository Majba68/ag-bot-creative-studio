import { useEffect, useMemo, useState } from 'react'
import { Check, Search, WifiOff } from 'lucide-react'
import { useApp } from '../state'

export function CurrencyPicker({ onSelect }: { onSelect?: () => void } = {}) {
  const { pairs, pairsLoading, settings, updateSettings } = useApp()
  const [tab, setTab] = useState<'forex' | 'otc'>(settings.marketType)
  const [query, setQuery] = useState('')

  useEffect(() => setTab(settings.marketType), [settings.marketType])

  const list = useMemo(() => {
    const source = tab === 'forex' ? pairs.forex : pairs.otc
    const term = query.trim().toLowerCase()
    if (!term) return source
    return source.filter((pair) =>
      `${pair.symbol} ${pair.name} ${pair.base ?? ''} ${pair.quote ?? ''}`.toLowerCase().includes(term),
    )
  }, [pairs, query, tab])

  const select = (symbol: string, category: 'forex' | 'otc') => {
    updateSettings({ symbol, marketType: category })
    onSelect?.()
  }

  return (
    <section className="panel picker-panel">
      <div className="panel-head">
        <div>
          <h2>Currency pairs</h2>
          <p>Search and select a market</p>
        </div>
      </div>

      <div className="picker-tabs">
        <button type="button" className={tab === 'forex' ? 'active' : ''} onClick={() => setTab('forex')}>
          FOREX <span>{pairs.forex.length || '—'}</span>
        </button>
        <button type="button" className={tab === 'otc' ? 'active' : ''} onClick={() => setTab('otc')}>
          OTC / SYNTHETIC <span>{pairs.otc.length || '—'}</span>
        </button>
      </div>

      <label className="search-field">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search EUR, USD, JPY..."
          aria-label="Search currency pairs"
        />
      </label>

      {tab === 'otc' && (
        <div className="picker-notice">
          <WifiOff size={15} />
          <span>Broker-generated OTC instruments have no independent public live feed. They are listed for reference only — no prices or analysis are shown.</span>
        </div>
      )}

      <div className="pair-list">
        {pairsLoading && <div className="list-loading">Loading catalogue…</div>}
        {!pairsLoading && list.length === 0 && <div className="list-loading">No pairs match “{query}”.</div>}
        {list.map((pair) => {
          const active = pair.symbol === settings.symbol
          return (
            <button
              type="button"
              key={pair.symbol}
              className={`pair-row${active ? ' active' : ''}`}
              onClick={() => select(pair.symbol, pair.category)}
              title={pair.note}
            >
              <span className={`pair-dot ${pair.category}`} />
              <span className="pair-text">
                <strong>{pair.symbol}</strong>
                <small>{pair.name}</small>
              </span>
              <span className={`pair-tag ${pair.liveFeed ? 'live' : 'off'}`}>
                {pair.liveFeed ? 'LIVE FEED' : 'NO FEED'}
              </span>
              {active && <Check size={15} className="pair-check" />}
            </button>
          )
        })}
      </div>
    </section>
  )
}
