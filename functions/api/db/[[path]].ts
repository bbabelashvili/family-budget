// Cloudflare Pages Function — proxies /api/db/* → <supabase>/rest/v1/*
// Injects the service-role key server-side and requires a valid session token
// (minted by /api/auth/login). The public anon key is no longer used or trusted.

import { SUPABASE_URL } from '../../_lib/supabase'
import { verifyToken } from '../../_lib/token'

interface Env {
  SUPABASE_SERVICE_KEY: string
  SESSION_SECRET: string
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Gate: reject anything without a valid, unexpired session token.
  const token = request.headers.get('x-app-token')
  if (!(await verifyToken(env.SESSION_SECRET, token))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // supabase-js builds full paths like /rest/v1/debts under the proxy base,
  // so forward everything after /api/db verbatim to the Supabase origin.
  const url = new URL(request.url)
  const restPath = url.pathname.replace(/^\/api\/db/, '')
  const targetUrl = `${SUPABASE_URL}${restPath}${url.search}`

  // Forward the supabase-js request headers (Accept-Profile, Prefer, Range, etc.),
  // but strip the client's own auth/apikey and inject the service role instead.
  const headers = new Headers()
  for (const [key, value] of request.headers.entries()) {
    const k = key.toLowerCase()
    if (k === 'host' || k === 'origin' || k.startsWith('cf-')) continue
    if (k === 'authorization' || k === 'apikey' || k === 'x-app-token') continue
    headers.set(key, value)
  }
  headers.set('apikey', env.SUPABASE_SERVICE_KEY)
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_KEY}`)

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
  })

  const responseHeaders = new Headers(response.headers)
  responseHeaders.set('Access-Control-Allow-Origin', '*')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}
