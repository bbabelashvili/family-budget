// Cloudflare Pages Function — proxies /api/gemini/* → https://generativelanguage.googleapis.com/*
// The API key is injected here server-side so it never appears in the JS bundle or request URLs.

interface Env {
  GEMINI_API_KEY: string
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Rewrite: /api/gemini/v1beta/models/... → /v1beta/models/...
  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/api\/gemini/, '')

  // Inject key server-side as query param (Gemini auth method)
  url.searchParams.set('key', env.GEMINI_API_KEY)
  const targetUrl = `https://generativelanguage.googleapis.com${targetPath}?${url.searchParams.toString()}`

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
