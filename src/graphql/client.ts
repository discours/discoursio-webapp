import { Client, cacheExchange, createClient, fetchExchange, SSRData, ssrExchange } from '@urql/core'
import { DocumentNode } from 'graphql'
import { createResource, ResourceReturn } from 'solid-js'
import { coreApiUrl } from '~/config'
import { GraphQLResponse } from './types'

// API URL для разных окружений

// Определяем окружение
const isServer = typeof window === 'undefined'

// Типы для ресурсов
export type ResourceArgs<T> = [T, Client]

/**
 * Создает реактивный ресурс для GraphQL запросов
 */
export function createQueryResource<T, Args extends readonly unknown[]>(
  query: DocumentNode,
  getVariables: (...args: Args) => Record<string, unknown>,
  client: Client
): (...args: Args) => ResourceReturn<T> {
  return (...args: Args) => {
    return createResource(
      () => args,
      async (args) => {
        const variables = getVariables(...args)
        const response = await client.query(query, variables).toPromise()
        return response?.data as T
      }
    )
  }
}

/**
 * Проверяет доступность API
 */
export const checkApiAvailability = async (): Promise<boolean> => {
  try {
    const response = await fetch(coreApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: '{ __typename }'
      })
    })

    if (!response.ok) {
      await response.text()
      console.warn(`[API Test] API returned status ${response.status}`)
      return false
    }

    await response.json()
    return true
  } catch {
    console.warn('[API Test] Ошибка подключения к API')
    return false
  }
}

// Создаем SSR exchange для гидрации
const ssr = ssrExchange({
  isClient: !isServer,
  initialState: !isServer ? (window as { __URQL_DATA__?: SSRData }).__URQL_DATA__ : undefined
})

// Настройки fetch для клиента
const fetchOptions: RequestInit = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
}

// Создаем GraphQL клиент
export const client = createClient({
  url: coreApiUrl,
  exchanges: [cacheExchange, ssr, fetchExchange],
  fetchOptions,
  requestPolicy: 'cache-and-network',
  // urql@6: disable GET for queries to keep compatibility if server doesn't support it
  preferGetMethod: false,
  // SSR оптимизации
  ...(isServer && {
    requestPolicy: 'network-only', // В SSR всегда загружаем свежие данные
    fetchOptions: {
      ...fetchOptions,
      // Увеличиваем timeout для SSR
      signal: AbortSignal.timeout(25000) // 25 секунд для SSR
    }
  })
})

/**
 * Создает GraphQL клиент с авторизацией
 * Используется для создания клиентов с токенами авторизации
 */
export function graphqlClientCreate(apiUrl: string = coreApiUrl, token?: string) {
  const fetchOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  }

  return createClient({
    url: apiUrl,
    exchanges: [cacheExchange, ssr, fetchExchange],
    fetchOptions,
    requestPolicy: 'cache-and-network',
    preferGetMethod: false
  })
}

// Экспортируем как defaultClient для совместимости
export const defaultClient = client

// Экспортируем для гидрации
if (!isServer) {
  ;(window as { __URQL_DATA__?: SSRData }).__URQL_DATA__ = ssr.extractData()
}

/**
 * Создает простой загрузчик для GraphQL запросов
 * Используется для SSR и одноразовых запросов без кеширования
 */
export function createLoader<T, Args>(
  query: DocumentNode,
  getVariables: (args: Args) => Record<string, unknown>
): (args: Args) => () => Promise<T> {
  return (args: Args) => {
    return async () => {
      const variables = getVariables(args)
      const response = await client.query(query, variables).toPromise()
      return response?.data as T
    }
  }
}

/**
 * Создает кешируемый загрузчик для GraphQL запросов
 * Использует браузерное кеширование для статичных данных
 */
export function createCacheableLoader<T, Args>(
  query: DocumentNode,
  getVariables: (args: Args) => Record<string, unknown>,
  enableCache = false
): (args: Args) => () => Promise<T> {
  return (args: Args) => {
    return async () => {
      const variables = getVariables(args)

      // Если кеширование включено, используем fetch с кешированием
      // Убираем проверку !isServer чтобы кеширование работало и в SSR
      if (enableCache) {
        // В SSR используем только память, в браузере - sessionStorage
        if (!isServer) {
          const cacheKey = `graphql-${JSON.stringify({ query: query.loc?.source.body, variables })}`
          const cached = sessionStorage.getItem(cacheKey)

          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              if (Date.now() - parsed.timestamp < 1800000) {
                // 30 минут
                return parsed.data as T
              }
            } catch (_e) {
              // Игнорируем ошибки парсинга кеша
            }
          }
        }

        const response = await client.query(query, variables).toPromise()
        const data = response?.data as T

        // Кешируем результат только в браузере
        if (!isServer) {
          const cacheKey = `graphql-${JSON.stringify({ query: query.loc?.source.body, variables })}`
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({
              data,
              timestamp: Date.now()
            })
          )
        }

        return data
      }

      // Обычный запрос без кеширования
      const response = await client.query(query, variables).toPromise()
      return response?.data as T
    }
  }
}

/**
 * Создает кешируемый реактивный ресурс для GraphQL запросов
 * Комбинирует кеширование с реактивностью SolidJS
 */
export function createCacheableQueryResource<T, Args>(
  query: DocumentNode,
  getVariables: (args: Args) => Record<string, unknown>,
  enableCache = false,
  clientInstance: Client = client,
  withAbort = false
): (args: Args) => ResourceReturn<T> {
  return (args: Args) => {
    return createResource(
      () => args,
      async (args) => {
        const variables = getVariables(args)

        // Если кеширование включено, используем fetch с кешированием
        if (enableCache && !isServer) {
          const cacheKey = `graphql-resource-${JSON.stringify({ query: query.loc?.source.body, variables })}`
          const cached = sessionStorage.getItem(cacheKey)

          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              if (Date.now() - parsed.timestamp < 1800000) {
                // 30 минут
                return parsed.data as T
              }
            } catch (_e) {
              // Игнорируем ошибки парсинга кеша
            }
          }

          const response = await clientInstance.query(query, variables).toPromise()
          const data = response?.data as T

          // Кешируем результат
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({
              data,
              timestamp: Date.now()
            })
          )

          return data
        }

        // Обычный запрос без кеширования
        const response = await clientInstance.query(query, variables).toPromise()
        return response?.data as T
      },
      {
        // Добавляем поддержку отмены запросов если включено
        ...(withAbort && {
          deferStream: true
        })
      }
    )
  }
}

/**
 * Обрабатывает GraphQL ошибки (устраняет дублирование)
 */
// biome-ignore lint/suspicious/noExplicitAny: graphql
export const handleGraphQLError = (response: GraphQLResponse<any>, operation: string): boolean => {
  if (response?.error) {
    console.error(`[GraphQL] API error in ${operation}:`, response.error)
    return true
  }
  if (response?.data?.[operation]?.error) {
    console.error(`[GraphQL] API error in ${operation}:`, response.data[operation].error)
    return true
  }
  return false
}
