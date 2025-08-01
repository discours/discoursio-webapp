import { createClient, cacheExchange, fetchExchange, ssrExchange } from '@urql/core'
import { createResource, ResourceReturn } from 'solid-js'

// API URL для разных окружений
const coreApiUrl = 'https://v3.dscrs.site/graphql'

// Определяем окружение
const isServer = typeof window === 'undefined'
const isTest = process.env.NODE_ENV === 'test' || process.env.CI === 'true'

// Типы для ресурсов
export type ResourceArgs<T> = [T, any]

/**
 * Создает реактивный ресурс для GraphQL запросов
 */
export function createQueryResource<T, Args extends any[]>(
  query: any,
  getVariables: (...args: Args) => any,
  client: any
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
 * Получает URL для GraphQL API в зависимости от окружения
 */
const getApiUrl = (): string => {
  // В браузере всегда используем локальный прокси для избежания CORS
  if (!isServer) {
    return '/graphql'
  }
  
  // В SSR используем прямой API
  return coreApiUrl
}

/**
 * Проверяет доступность API
 */
export const checkApiAvailability = async (): Promise<boolean> => {
  try {
    const apiUrl = getApiUrl()
    console.log(`[API Test] Проверка подключения к API: ${apiUrl}`)
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: '{ __typename }'
      })
    })

    console.log(`[API Test] Ответ API: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.log(`[API Test] Ошибка API: ${errorText}`)
      return false
    }

    const data = await response.json()
    console.log(`[API Test] Успешный ответ от API:`, data)
    return true
  } catch (error) {
    console.log(`[API Test] Ошибка подключения к API:`, error)
    console.log(`[API Test] Тип ошибки: ${error instanceof Error ? error.name : 'Unknown'}`)
    console.log(`[API Test] Сообщение: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

// Создаем SSR exchange для гидрации
const ssr = ssrExchange({
  isClient: !isServer,
  initialState: !isServer ? (window as any).__URQL_DATA__ : undefined
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
  url: getApiUrl(),
  exchanges: [
    cacheExchange,
    ssr,
    fetchExchange
  ],
  fetchOptions,
  requestPolicy: 'cache-and-network'
})

// Экспортируем как defaultClient для совместимости
export const defaultClient = client

// Экспортируем для гидрации
if (!isServer) {
  (window as any).__URQL_DATA__ = ssr.extractData()
}
