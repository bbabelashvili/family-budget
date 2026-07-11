import { supabase } from './supabase'
import type { ProfileId } from '../types'

const SESSION_KEY = 'budget_session'
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getSession(): { profileId: ProfileId } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as { profileId: ProfileId; expiresAt: number }
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return { profileId: session.profileId }
  } catch {
    return null
  }
}

export function setSession(profileId: ProfileId): void {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ profileId, expiresAt: Date.now() + SESSION_DURATION_MS }),
  )
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export async function getProfilePinHash(profileId: ProfileId): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('pin_hash')
    .eq('id', profileId)
    .single()
  return data?.pin_hash ?? null
}

export async function setProfilePin(profileId: ProfileId, pin: string): Promise<void> {
  const hash = await sha256(pin)
  await supabase.from('profiles').update({ pin_hash: hash }).eq('id', profileId)
}

export async function verifyPin(profileId: ProfileId, pin: string): Promise<boolean> {
  const storedHash = await getProfilePinHash(profileId)
  if (!storedHash) return false
  const inputHash = await sha256(pin)
  return inputHash === storedHash
}

export async function clearProfilePin(profileId: ProfileId): Promise<void> {
  await supabase.from('profiles').update({ pin_hash: null }).eq('id', profileId)
}

// ── App-level lock (server-verified, token-gated) ────────────────────────────
// The app-unlock PIN is verified server-side; a correct PIN (or the master PIN)
// returns an HMAC session token that gates every DB request via the proxy.

import { DB_TOKEN_KEY } from './supabase'

// Is an app-unlock PIN configured yet?
export async function appHasPin(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/login')
    if (!res.ok) return false
    const { hasPin } = await res.json() as { hasPin: boolean }
    return hasPin
  } catch { return false }
}

// Verify an app PIN (or master PIN); on success store the session token.
export async function verifyAppPin(pin: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    if (!res.ok) return false
    const { token } = await res.json() as { token: string }
    localStorage.setItem(DB_TOKEN_KEY, token)
    return true
  } catch { return false }
}

// Master-gated: set/replace the app-unlock PIN.
export async function setAppPin(pin: string, masterPin: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/set-app-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterPin, newPin: pin }),
    })
    return res.ok
  } catch { return false }
}

// Verify the master PIN server-side (used by profile PIN reset).
export async function verifyMasterPin(pin: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/master', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    return res.ok
  } catch { return false }
}

export function clearAppSession(): void {
  localStorage.removeItem(DB_TOKEN_KEY)
}

// Valid app session === a present, unexpired token.
export function getAppSession(): boolean {
  const token = localStorage.getItem(DB_TOKEN_KEY)
  if (!token) return false
  try {
    const payload = token.slice(0, token.lastIndexOf('.'))
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp: number }
    if (Date.now() >= exp) { localStorage.removeItem(DB_TOKEN_KEY); return false }
    return true
  } catch { return false }
}
