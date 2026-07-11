import { createClient } from '@supabase/supabase-js'

// All DB access goes through the same-origin proxy Function (/api/db), which
// injects the service-role key server-side and requires a valid session token.
// The public anon key is no longer used — the client sends x-app-token instead.
const proxyUrl = `${window.location.origin}/api/db`

export const DB_TOKEN_KEY = 'budget_db_token'

// Inject the session token on every proxied request. Reading it per-call (rather
// than baking it into a header at client-creation) means a fresh login is picked
// up without recreating the client.
const proxyFetch: typeof fetch = (input, init = {}) => {
  const headers = new Headers(init.headers)
  const token = localStorage.getItem(DB_TOKEN_KEY)
  if (token) headers.set('x-app-token', token)
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(proxyUrl, 'proxy', {
  db: { schema: 'budget' },
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: proxyFetch },
})
