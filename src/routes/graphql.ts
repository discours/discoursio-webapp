import type { APIEvent } from '@solidjs/start/server'
import { coreApiUrl } from '~/config'
import { graphqlClientCreate } from '~/graphql/client'

// Регулярное выражение для извлечения псевдонима запроса
const QUERY_ALIAS_REGEX = /query\s+(\w+)/

/**
 * Проверяет, можно ли кешировать GraphQL запрос в браузере
 * @param query - GraphQL запрос
 * @param variables - переменные запроса
 * @returns true если запрос можно кешировать в браузере
 */
function isStaticQuery(query: string, variables?: Record<string, unknown>): boolean {
  // Статичные операции для кеширования (не содержат персональных данных)
  // Это реальные имена операций GraphQL (не псевдонимы)
  const staticOperations = [
    'get_topics_by_community',
    'get_topics',
    'get_authors',
    'get_author',
    'load_authors_by',
    'get_shouts',
    'get_shout',
    'load_shouts_by',
    'get_topic_followers',
    'get_topic_authors',
    'load_topic_authors',
    'load_topic_followers'
  ]

  // Проверяем, содержит ли запрос статичные операции
  const hasStaticOperation = staticOperations.some((operation) => query.includes(operation))

  // Извлекаем псевдоним запроса для более понятного логирования
  const queryAliasMatch = query.match(QUERY_ALIAS_REGEX)
  const queryAlias = queryAliasMatch?.[1] || 'UnnamedQuery'

  // Находим реальные операции в запросе
  const foundOperations = staticOperations.filter((op) => query.includes(op))

  if (!hasStaticOperation) {
    console.log(`[GraphQL Route] Rejected: No static operations found in query ${queryAlias}`)
    return false
  }

  // Дополнительная проверка переменных на отсутствие персональных данных
  if (variables) {
    const variableString = JSON.stringify(variables).toLowerCase()
    // Исключаем запросы с персональными идентификаторами
    if (
      variableString.includes('user') ||
      variableString.includes('author_id') ||
      variableString.includes('my_') ||
      variableString.includes('session') ||
      variableString.includes('token')
    ) {
      console.log(
        `[GraphQL Route] Rejected: Personal data detected in variables for ${queryAlias}`,
        variables
      )
      return false
    }
  }

  console.log(
    `[GraphQL Route] Approved for caching: ${queryAlias} with operations [${foundOperations.join(', ')}]`
  )
  return true
}

/**
 * Получает время кеширования для запроса
 * @param query - GraphQL запрос
 * @returns Cache-Control заголовок
 */
function getCacheControl(query: string): string {
  // Топики редко меняются - долгое кеширование
  if (
    query.includes('get_topics') ||
    query.includes('get_topic_authors') ||
    query.includes('load_topic_authors') ||
    query.includes('get_topic_followers') ||
    query.includes('load_topic_followers')
  ) {
    return 'public, max-age=10800, s-maxage=36000' // 3ч браузер, 10ч CDN
  }

  // Авторы меняются нечасто
  if (query.includes('get_authors') || query.includes('get_author') || query.includes('load_authors_by')) {
    return 'public, max-age=1800, s-maxage=3600' // 30мин браузер, 1ч CDN
  }

  // Статьи обновляются часто - короткое кеширование
  if (query.includes('get_shouts') || query.includes('get_shout') || query.includes('load_shouts_by')) {
    return 'public, max-age=60, s-maxage=300' // 1мин браузер, 5мин CDN
  }

  // По умолчанию - короткое кеширование
  return 'public, max-age=300, s-maxage=900' // 5мин браузер, 15мин CDN
}

/**
 * GET /graphql
 * Кешируемый GraphQL endpoint для публичных запросов
 *
 * Query parameters:
 * - query: GraphQL запрос (обязательный)
 * - variables: JSON строка с переменными (опциональный)
 *
 * @example
 * GET /graphql?query=query{get_topics_all{id,slug,title}}&variables={}
 */
export async function GET({ request }: APIEvent) {
  const url = new URL(request.url)
  const query = url.searchParams.get('query')
  const variablesParam = url.searchParams.get('variables')

  console.log(`[GraphQL Route] Incoming request to ${url.pathname}`)

  if (!query) {
    console.log('[GraphQL Route] Bad request: Missing query parameter')
    return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  let variables: Record<string, unknown> = {}

  // Парсим переменные если есть
  if (variablesParam) {
    try {
      variables = JSON.parse(variablesParam)
    } catch {
      console.log('[GraphQL Route] Bad request: Invalid variables JSON')
      return new Response(JSON.stringify({ error: 'Invalid variables JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  // Проверяем, можно ли кешировать этот запрос
  if (!isStaticQuery(query, variables)) {
    return new Response(JSON.stringify({ error: 'Query not allowed for caching' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const client = graphqlClientCreate(coreApiUrl)

  try {
    console.log('[GraphQL Route] Executing GraphQL query...')
    // Выполняем GraphQL запрос
    const result = await client.query(query, variables).toPromise()

    if (result.error) {
      console.error('[GraphQL Route] GraphQL error:', result.error)
      return new Response(JSON.stringify({ error: result.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const cacheControl = getCacheControl(query)
    console.log(`[GraphQL Route] Success: Returning cached response with ${cacheControl}`)

    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
      // Добавляем CORS для клиентских запросов
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      // Добавляем ETag для более эффективного кеширования
      ETag: `"${Buffer.from(query + JSON.stringify(variables)).toString('base64')}"`
    })

    return new Response(JSON.stringify(result.data), { headers })
  } catch (error) {
    console.error('[GraphQL Route] GraphQL request failed:', error)
    return new Response(JSON.stringify({ error: 'GraphQL request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * OPTIONS /graphql
 * CORS preflight для кроссдоменных запросов
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400' // 24 часа
    }
  })
}
