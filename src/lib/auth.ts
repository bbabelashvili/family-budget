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

// ── App-level lock (localStorage) ────────────────────────────────────────────

const APP_PIN_KEY = 'budget_app_pin_hash'
const APP_SESSION_KEY = 'budget_app_session'
const APP_SESSION_MS = 24 * 60 * 60 * 1000

export function getAppPinHash(): string | null {
  return localStorage.getItem(APP_PIN_KEY)
}

export async function setAppPin(pin: string): Promise<void> {
  localStorage.setItem(APP_PIN_KEY, await sha256(pin))
}

export async function verifyAppPin(pin: string): Promise<boolean> {
  const hash = localStorage.getItem(APP_PIN_KEY)
  if (!hash) return false
  return (await sha256(pin)) === hash
}

export function clearAppPin(): void {
  localStorage.removeItem(APP_PIN_KEY)
}

export function getAppSession(): boolean {
  try {
    const raw = localStorage.getItem(APP_SESSION_KEY)
    if (!raw) return false
    const { expiresAt } = JSON.parse(raw) as { expiresAt: number }
    if (Date.now() > expiresAt) { localStorage.removeItem(APP_SESSION_KEY); return false }
    return true
  } catch { return false }
}

export function setAppSession(): void {
  localStorage.setItem(APP_SESSION_KEY, JSON.stringify({ expiresAt: Date.now() + APP_SESSION_MS }))
}
