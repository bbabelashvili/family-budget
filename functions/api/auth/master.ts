// POST /api/auth/master  { pin } -> { ok } | 401
// Server-side master-PIN check (keeps the master PIN out of the JS bundle).
// Used by the profile "Forgot PIN?" reset flow.

import { type Env } from '../../_lib/supabase'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context
  const { pin } = await request.json().catch(() => ({})) as { pin?: string }
  await new Promise(r => setTimeout(r, 400))
  if (pin && pin === env.MASTER_PIN) return json({ ok: true })
  return json({ ok: false }, 401)
}
