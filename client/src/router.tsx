import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react'

export interface RouteState {
  path: string
  query: URLSearchParams
  hash: string
}

// GitHub Pages (and other static hosts) only serve the root document. Keeping the
// app route in the URL hash makes every route/shareable link reload correctly.
const PREFIX = '#/'

function toHash(to: string): string {
  const raw = to.startsWith('/') ? to : `/${to}`
  return `${PREFIX}${raw.replace(/^\//, '')}`
}

function parse(): RouteState {
  const raw = window.location.hash.startsWith(PREFIX)
    ? window.location.hash.slice(PREFIX.length)
    : '/'
  const [routePart, anchor = ''] = raw.split('#')
  const [pathname, search = ''] = routePart.split('?')
  const path = pathname.replace(/\/+$/, '') || '/'
  return { path, query: new URLSearchParams(search), hash: anchor ? `#${anchor}` : '' }
}

export function navigate(to: string, replace = false) {
  const url = `${window.location.pathname}${window.location.search}${toHash(to)}`
  if (replace) window.history.replaceState({}, '', url)
  else window.history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): RouteState {
  const [route, setRoute] = useState<RouteState>(parse)
  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('popstate', onChange)
    window.addEventListener('hashchange', onChange)
    return () => {
      window.removeEventListener('popstate', onChange)
      window.removeEventListener('hashchange', onChange)
    }
  }, [])
  return route
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
  children: ReactNode
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
  return <a href={toHash(to)} onClick={handle} {...rest}>{children}</a>
}

export function buildQuery(base: string, values: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '' || value === false) return
    params.set(key, String(value))
  })
  const query = params.toString()
  return query ? `${base}?${query}` : base
}
