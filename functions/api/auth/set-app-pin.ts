// POST /api/auth/set-app-pin  { masterPin, newPin } -> { ok } | 401
// Master-gated: sets/replaces the shared app-unlock PIN. Used on first-launch
// setup and on "Forgot PIN?" reset.

import { setAppPinHash, type Env } from '../../_lib/supabase'
import { sha256Hex } from '../../_lib/token'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context
  const { masterPin, newPin } = await request.json().catch(() => ({})) as
    { masterPin?: string; newPin?: string }

  await new Promise(r => setTimeout(r, 400))
  if (masterPin !== env.MASTER_PIN) return json({ error: 'invalid master pin' }, 401)
  if (!newPin || newPin.length < 4) return json({ error: 'pin too short' }, 400)

  await setAppPinHash(env, await sha256Hex(newPin))
  return json({ ok: true })
}
