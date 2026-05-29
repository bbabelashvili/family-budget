// Cloudflare Pages Function — proxies /api/anthropic/* → https://api.anthropic.com/*
// The API key is injected here server-side so it never appears in the JS bundle.

interface Env {
  ANTHROPIC_API_KEY: string
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Rewrite path: /api/anthropic/v1/messages → /v1/messages
  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/api\/anthropic/, '')
  const targetUrl = `https://api.anthropic.com${targetPath}${url.search}`

  // Forward headers, inject API key server-side, strip Cloudflare internals
  const headers = new Headers()
  for (const [key, value] of request.headers.entries()) {
    const k = key.toLowerCase()
    if (k !== 'host' && k !== 'origin' && !k.startsWith('cf-')) {
      headers.set(key, value)
    }
  }
  headers.set('x-api-key', env.ANTHROPIC_API_KEY)

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.body,
  })

  const responseHeaders = new Headers(response.headers)
  responseHeaders.set('Access-Control-Allow-Origin', '*')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}
