// GET  /api/auth/login  -> { hasPin }   (is an app-unlock PIN set yet?)
// POST /api/auth/login  { pin } -> { token } | 401
// A correct app PIN OR the master PIN mints a 24h session token for the DB proxy.

import { getAppPinHash, type Env } from '../../_lib/supabase'
import { sha256Hex, signToken } from '../../_lib/token'

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })

export async function onRequestGet(context: { env: Env }) {
  const hash = await getAppPinHash(context.env)
  return json({ hasPin: hash !== null })
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context
  const { pin } = await request.json().catch(() => ({ pin: '' })) as { pin?: string }
  if (!pin) return json({ error: 'pin required' }, 400)

  const [storedHash, inputHash] = await Promise.all([
    getAppPinHash(env),
    sha256Hex(pin),
  ])

  const matchesApp = storedHash !== null && inputHash === storedHash
  const matchesMaster = pin === env.MASTER_PIN
  // Small constant delay to blunt online brute-forcing of short PINs.
  await new Promise(r => setTimeout(r, 400))

  if (!matchesApp && !matchesMaster) return json({ error: 'invalid' }, 401)
  return json({ token: await signToken(env.SESSION_SECRET, TOKEN_TTL_MS) })
}
