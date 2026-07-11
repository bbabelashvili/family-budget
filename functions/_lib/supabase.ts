// Server-side Supabase REST helpers, used by the auth Functions.
// The service-role key bypasses RLS and is only ever present here (never in the bundle).

export const SUPABASE_URL = 'https://unqgoopxwjxjenkyxgxr.supabase.co'
export const SCHEMA = 'budget'

export interface Env {
  SUPABASE_SERVICE_KEY: string
  SESSION_SECRET: string
  MASTER_PIN: string
}

function serviceHeaders(env: Env, extra: Record<string, string> = {}): Headers {
  const h = new Headers({
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Accept-Profile': SCHEMA,
    'Content-Profile': SCHEMA,
    ...extra,
  })
  return h
}

// Read the singleton app_auth row's pin_hash (or null if unset).
export async function getAppPinHash(env: Env): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_auth?id=eq.1&select=pin_hash`, {
    headers: serviceHeaders(env),
  })
  if (!res.ok) throw new Error(`app_auth read failed: ${res.status}`)
  const rows = await res.json() as { pin_hash: string | null }[]
  return rows[0]?.pin_hash ?? null
}

// Update the singleton app_auth row's pin_hash.
export async function setAppPinHash(env: Env, hash: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_auth?id=eq.1`, {
    method: 'PATCH',
    headers: serviceHeaders(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ pin_hash: hash, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`app_auth write failed: ${res.status}`)
}
