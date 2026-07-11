// HMAC-signed session tokens for the DB proxy gate.
// Token format:  base64url(JSON{exp}) + "." + hex(HMAC-SHA256(payload))
// Signed with the server-only SESSION_SECRET so it cannot be forged client-side.

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return toHex(sig)
}

// Constant-time string compare to avoid timing leaks on the signature.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return toHex(hash)
}

export async function signToken(secret: string, ttlMs: number): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ exp: Date.now() + ttlMs })))
  const sig = await hmac(secret, payload)
  return `${payload}.${sig}`
}

export async function verifyToken(secret: string, token: string | null): Promise<boolean> {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot < 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = await hmac(secret, payload)
  if (!safeEqual(sig, expected)) return false
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const { exp } = JSON.parse(json) as { exp: number }
    return typeof exp === 'number' && Date.now() < exp
  } catch {
    return false
  }
}
