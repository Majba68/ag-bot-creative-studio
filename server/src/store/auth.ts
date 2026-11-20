import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { config } from '../config.js'

const SESSION_MS = 12 * 60 * 60 * 1000
const MAX_PASSWORD_LENGTH = 1024

/** No password means an intentionally open local/demo installation. */
export const authRequired = config.adminPassword.length > 0

const signingSecret = config.adminSecret
  || createHash('sha256').update(`trapo-store:${config.adminPassword}`).digest('hex')
  || 'trapo-local-demo-secret'

/** Constant-time comparison even when the inputs have different lengths. */
function safeEqualText(left: string, right: string): boolean {
  const a = createHash('sha256').update(left).digest()
  const b = createHash('sha256').update(right).digest()
  return timingSafeEqual(a, b)
}

export function verifyPassword(password: unknown): boolean {
  if (!authRequired || typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) return false
  return safeEqualText(password, config.adminPassword)
}

export function issueAdminToken(): { token: string; expiresAt: string } {
  const expiry = Date.now() + SESSION_MS
  const payload = `admin:${expiry}`
  const signature = createHmac('sha256', signingSecret).update(payload).digest('base64url')
  return { token: `${payload}.${signature}`, expiresAt: new Date(expiry).toISOString() }
}

export function verifyAdminToken(token: string): boolean {
  if (!token || token.length > 512) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payload, signature] = parts
  if (!payload.startsWith('admin:')) return false

  const expected = createHmac('sha256', signingSecret).update(payload).digest('base64url')
  if (!safeEqualText(signature, expected)) return false

  const expiry = Number(payload.slice('admin:'.length))
  return Number.isFinite(expiry) && expiry > Date.now() && expiry <= Date.now() + SESSION_MS
}

function tokenFromRequest(req: Request): string | null {
  const header = req.get('authorization') || ''
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match ? match[1] : null
}

export function isAuthenticated(req: Request): boolean {
  if (!authRequired) return true
  const token = tokenFromRequest(req)
  return token !== null && verifyAdminToken(token)
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (isAuthenticated(req)) {
    next()
    return
  }
  res.status(401).json({ error: 'Unauthorized' })
}
