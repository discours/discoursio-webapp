import { type Client, type ClientOptions, cacheExchange, createClient, fetchExchange } from '@urql/core'
import { DocumentNode } from 'graphql'
import { ResourceFetcherInfo, createResource as createSolidResource } from 'solid-js'
import { coreApiUrl } from '~/config'

export type QueryResult<T> = { data?: { [key: string]: T } }
export type ResourceArgs<T> = readonly [T, Client | undefined]
export type GraphQLQuery = DocumentNode

/**
 * Создает загрузчик для GraphQL запросов
 * @param query - GraphQL запрос
 * @param getVariables - Функция получения переменных
 * @param client - GraphQL клиент (опционально)
 */
export const createLoader = <T, V>(
  query: GraphQLQuery,
  getVariables: (args: V) => Record<string, unknown>,
  client: Client = defaultClient
) => {
  return (args: V) => async (signal?: AbortSignal) => {
    const resp = await client.query(query, getVariables(args), { signal }).toPromise()
    const key = Object.keys(resp?.data || {})[0]
    return resp?.data?.[key] as T
  }
}

/**
 * Создает кешируемый загрузчик для публичных GraphQL запросов
 * Использует браузерное кеширование через API route /graphql для статичных данных
 * @param query - GraphQL запрос
 * @param getVariables - Функция получения переменных
 * @param useBrowserCache - Использовать браузерное кеширование (по умолчанию true в браузере)
 * @param client - GraphQL клиент для fallback (опционально)
 */
export const createCacheableLoader = <T, V>(
  query: GraphQLQuery,
  getVariables: (args: V) => Record<string, unknown>,
  useBrowserCache = true,
  client: Client = defaultClient
) => {
  return (args: V) => async (signal?: AbortSignal) => {
    // В браузере пытаемся использовать кешируемый API route
    if (useBrowserCache && typeof window !== 'undefined') {
      try {
        const variables = getVariables(args)
        const queryString = query.loc?.source?.body || ''

        const searchParams = new URLSearchParams({
          query: queryString,
          variables: JSON.stringify(variables)
        })

        // Получаем базовый URL приложения из location
        const baseUrl = `${window.location.protocol}//${window.location.host}`
        const graphqlUrl = `${baseUrl}/graphql?${searchParams}`

        // console.log(`[GraphQL Cache] Requesting ${queryString} with variables ${JSON.stringify(variables)}`)

        const response = await fetch(graphqlUrl, {
          signal,
          // Принимаем кешированные ответы
          cache: 'default'
        })

        if (response.ok) {
          const result = await response.json()
          console.log('[GraphQL Cache] Success:', result)
          // API route возвращает только data, извлекаем первый ключ
          const key = Object.keys(result || {})[0]
          return result?.[key] as T
        }

        // Если API route не поддерживает запрос, fallback к прямому GraphQL
        console.log('[GraphQL] API route failed, falling back to direct GraphQL client')
      } catch (error) {
        console.warn('[GraphQL] Browser cache failed, falling back to direct GraphQL:', error)
      }
    }

    // Fallback к прямому GraphQL клиенту (SSR или при ошибке кеширования)
    const resp = await client.query(query, getVariables(args), { signal }).toPromise()
    const key = Object.keys(resp?.data || {})[0]
    return resp?.data?.[key] as T
  }
}

/**
 * Создает реактивный ресурс для GraphQL запросов
 * @param withAbort - Включить поддержку AbortSignal (опционально)
 */
export const createQueryResource = <T, V>(
  query: GraphQLQuery,
  getVariables: (args: V) => Record<string, unknown>,
  client: Client = defaultClient,
  withAbort?: boolean
) => {
  const loader = createLoader<T, V>(query, getVariables, client)
  return (args: V) => {
    const source = () => args
    if (withAbort) {
      return createSolidResource<T, V, unknown>(
        source,
        (value: V, info: ResourceFetcherInfo<T, unknown>) => {
          const signal = (info.refetching as { signal?: AbortSignal })?.signal
          return loader(value)(signal)
        }
      )
    }
    return createSolidResource<T, V, unknown>(source, (value: V) => loader(value)())
  }
}

/**
 * Создает кешируемый реактивный ресурс для публичных GraphQL запросов
 * Использует браузерное кеширование для оптимизации загрузки статичных данных
 * @param useBrowserCache - Использовать браузерное кеширование
 * @param withAbort - Включить поддержку AbortSignal
 */
export const createCacheableQueryResource = <T, V>(
  query: GraphQLQuery,
  getVariables: (args: V) => Record<string, unknown>,
  useBrowserCache = true,
  client: Client = defaultClient,
  withAbort?: boolean
) => {
  const loader = createCacheableLoader<T, V>(query, getVariables, useBrowserCache, client)
  return (args: V) => {
    const source = () => args
    if (withAbort) {
      return createSolidResource<T, V, unknown>(
        source,
        (value: V, info: ResourceFetcherInfo<T, unknown>) => {
          const signal = (info.refetching as { signal?: AbortSignal })?.signal
          return loader(value)(signal)
        }
      )
    }
    return createSolidResource<T, V, unknown>(source, (value: V) => loader(value)())
  }
}

/**
 * Создает GraphQL клиент с настроенными заголовками и обработкой ошибок
 * @param url - URL GraphQL API
 * @param token - Токен авторизации (опционально)
 * @param origin - Origin заголовок (опционально)
 * @param timeout - Таймаут запроса в миллисекундах (по умолчанию 15000)
 * @returns Настроенный GraphQL клиент
 */
export const graphqlClientCreate = (url: string, token = '', timeout = 15000): Client => {
  // console.log('[GraphQL Client] Создание клиента:', { url, hasToken: !!token, timeout })

  const exchanges = [fetchExchange, cacheExchange]
  const options: ClientOptions = {
    url,
    exchanges,
    fetchOptions: () => {
      const controller = new AbortController()

      // Устанавливаем таймаут для запроса
      setTimeout(() => {
        //  console.warn('[GraphQL Client] Таймаут запроса через', timeout, 'мс')
        controller.abort()
      }, timeout)

      const headers = {
        'content-type': 'application/json',
        accept: 'application/graphql-response+json, application/graphql+json, application/json',
        ...(token
          ? {
              authorization: token
            }
          : {})
      }
      return {
        signal: controller.signal,
        headers,
        credentials: 'include',
        mode: 'cors'
      }
    }
  }

  const client = createClient(options)
  console.log('[GraphQL Client] Клиент создан успешно')
  return client
}

export const defaultClient: Client = graphqlClientCreate(coreApiUrl, '')
