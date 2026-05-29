// Cloudflare Pages Function — proxies /api/anthropic/* → https://api.anthropic.com/*
// Mirrors the Vite dev proxy so Anthropic works in production without CORS issues.

export async function onRequest(context: { request: Request }) {
  const { request } = context

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

  // Forward all headers except Cloudflare/host internals
  const headers = new Headers()
  for (const [key, value] of request.headers.entries()) {
    const k = key.toLowerCase()
    if (k !== 'host' && k !== 'origin' && !k.startsWith('cf-')) {
      headers.set(key, value)
    }
  }

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
