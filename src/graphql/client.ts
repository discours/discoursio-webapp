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
 * Создает GraphQL клиент с настроенными заголовками и обработкой ошибок
 * @param url - URL GraphQL API
 * @param token - Токен авторизации (опционально)
 * @param origin - Origin заголовок (опционально)
 * @param timeout - Таймаут запроса в миллисекундах (по умолчанию 15000)
 * @returns Настроенный GraphQL клиент
 */
export const graphqlClientCreate = (
  url: string,
  token = '',
  timeout = 15000
): Client => {
  const exchanges = [fetchExchange, cacheExchange]
  const options: ClientOptions = {
    url,
    exchanges,
    fetchOptions: () => {
      const controller = new AbortController()

      // Устанавливаем таймаут для запроса
      setTimeout(() => {
        controller.abort()
      }, timeout)
      return {
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          accept: 'application/graphql-response+json, application/graphql+json, application/json',
          ...(token
            ? {
                authorization: token
              }
            : {})
        },
        credentials: 'include',
        mode: 'cors'
      }
    }
  }

  return createClient(options)
}

export const defaultClient: Client = graphqlClientCreate(
  coreApiUrl,
  ''
)
