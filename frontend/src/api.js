/**
 * Backend origin for API calls.
 * - Vercel (same domain): leave VITE_API_BASE_URL unset → use absolute URLs via window.location.origin
 *   so paths never resolve relative to /results/... (which caused /results/v2/... 404s).
 * - Separate API host: set VITE_API_BASE_URL at build time (no trailing slash).
 * - Local dev (unset VITE_API_BASE_URL): use same origin so Vite's server.proxy forwards to
 *   FastAPI (works on any dev port and avoids CORS).
 */
function resolveApiBase() {
  const raw = (import.meta.env.VITE_API_BASE_URL || '').trim()
  if (raw) return raw.replace(/\/$/, '')
  if (import.meta.env.DEV) return ''
  return ''
}

export const API_BASE = resolveApiBase()

/** Full URL for an API path (leading slash). Prefer this over string concat for fetch(). */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = resolveApiBase()
  if (base) return `${base}${p}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(p, window.location.origin).href
  }
  return p
}

/** No-op for same-origin production (API_BASE may be ''). Kept for call sites that want an explicit check. */
export function ensureApiBase() {}

export async function apiFetch(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const res = await fetch(apiUrl(normalizedPath), options)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
