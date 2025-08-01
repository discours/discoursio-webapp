import type { APIEvent } from '@solidjs/start/server'
import { coreApiUrl } from '~/config'

/**
 * GraphQL прокси для обхода CORS в тестах
 * Проксирует все запросы к внешнему API
 */
export async function GET({ request }: APIEvent) {
  const url = new URL(request.url)
  const query = url.searchParams.get('query')
  const variablesParam = url.searchParams.get('variables')

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  let variables: Record<string, unknown> = {}
  if (variablesParam) {
    try {
      variables = JSON.parse(variablesParam)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid variables JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  try {
    const response = await fetch(coreApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  } catch (error) {
    console.error('[GraphQL Proxy] Error:', error)
    return new Response(JSON.stringify({ error: 'GraphQL request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function POST({ request }: APIEvent) {
  try {
    const body = await request.json()
    const { query, variables = {} } = body

    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing query in body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Получаем токен авторизации
    const authHeader = request.headers.get('authorization')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    if (authHeader) {
      headers.Authorization = authHeader
    }

    const response = await fetch(coreApiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  } catch (error) {
    console.error('[GraphQL Proxy] POST Error:', error)
    return new Response(JSON.stringify({ error: 'GraphQL POST request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}
