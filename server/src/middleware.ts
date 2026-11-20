import type { NextFunction, Request, Response } from 'express'

/** Small in-memory rate limiter — no extra dependency, per-IP fixed window. */
export function rateLimit(windowMs: number, max: number) {
  const hits = new Map<string, number[]>()

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown'
    const now = Date.now()
    const previous = hits.get(key) ?? []
    const recent = previous.filter((time) => now - time < windowMs)

    if (recent.length >= max) {
      res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' })
      return
    }

    recent.push(now)
    hits.set(key, recent)
    if (hits.size > 5000) {
      for (const [entry, times] of hits) {
        if (times.every((time) => now - time >= windowMs)) hits.delete(entry)
      }
    }
    next()
  }
}
