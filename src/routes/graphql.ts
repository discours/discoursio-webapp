import { graphqlClientCreate } from '~/graphql/client'
import { coreApiUrl } from '~/config'
import type { APIEvent } from '@solidjs/start/server'

/**
 * Определяет, является ли GraphQL запрос статичным (подходящим для кеширования)
 * @param query - GraphQL запрос
 * @param variables - Переменные запроса
 * @returns true если запрос можно кешировать в браузере
 */
function isStaticQuery(query: string, variables?: Record<string, any>): boolean {
  // Статичные запросы для кеширования (не содержат персональных данных)
  // Используем только реальные имена операций GraphQL
  const staticQueries = [
    'get_topics_all',              // Все топики
    'get_topics_by_community',     // Топики по сообществу
    'get_authors_all',             // Все авторы  
    'load_authors_by',             // Поиск авторов (публичные профили)
    'get_author',                  // Отдельный автор
    'load_shouts_by',              // Публичные статьи
    'get_shout',                   // Отдельная статья
    'load_shouts_search',          // Поиск статей
    'get_topic_authors',           // Авторы по топику
    'get_topic_followers'          // Подписчики топика
  ]
  
  // Проверяем, содержит ли запрос статичную операцию
  const isStatic = staticQueries.some(q => query.includes(q))
  
  // Дополнительные проверки переменных
  if (isStatic && variables) {
    // Не кешируем запросы с авторизацией
    if ('token' in variables || 'userId' in variables) {
      return false
    }
    
    // Не кешируем персонализованные запросы
    if (query.includes('load_shouts_by') && variables.options?.filters?.author) {
      // Кешируем запросы статей по автору (публичные)
      return true
    }
  }
  
  return isStatic
}

/**
 * Получает время кеширования для запроса
 * @param query - GraphQL запрос
 * @returns Cache-Control заголовок
 */
function getCacheControl(query: string): string {
  // Топики редко меняются - долгое кеширование (также сохраняются в IndexedDB)
  if (query.includes('get_topics_all') || query.includes('get_topic_authors') || 
      query.includes('get_topics_by_community')) {
    return 'public, max-age=10800, s-maxage=36000' // 3ч браузер, 10ч CDN
  }
  
  // Авторы меняются нечасто
  if (query.includes('get_authors_all') || query.includes('get_author') || 
      query.includes('load_authors_by')) {
    return 'public, max-age=1800, s-maxage=3600' // 30мин браузер, 1ч CDN  
  }
  
  // Статьи обновляются часто - короткое кеширование
  if (query.includes('get_shout') || query.includes('load_shouts_by') || 
      query.includes('load_shouts_search')) {
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
  
  if (!query) {
    return new Response(
      JSON.stringify({ error: 'Missing query parameter' }), 
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  let variables: Record<string, any> = {}
  
  // Парсим переменные если есть
  if (variablesParam) {
    try {
      variables = JSON.parse(variablesParam)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid variables JSON' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }

  // Проверяем, можно ли кешировать этот запрос
  if (!isStaticQuery(query, variables)) {
    return new Response(
      JSON.stringify({ error: 'Query not allowed for caching' }), 
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const client = graphqlClientCreate(coreApiUrl)
  
  try {
    // Выполняем GraphQL запрос
    const result = await client.query(query, variables).toPromise()
    
    if (result.error) {
      console.error('[API] GraphQL error:', result.error)
      return new Response(
        JSON.stringify({ error: result.error.message }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': getCacheControl(query),
      // Добавляем CORS для клиентских запросов
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      // Добавляем ETag для более эффективного кеширования
      'ETag': `"${Buffer.from(query + JSON.stringify(variables)).toString('base64')}"`
    })
    
    return new Response(JSON.stringify(result.data), { headers })
    
  } catch (error) {
    console.error('[API] GraphQL request failed:', error)
    return new Response(
      JSON.stringify({ error: 'GraphQL request failed' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
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
      'Access-Control-Max-Age': '86400', // 24 часа
    }
  })
} 