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
 * Создает GraphQL клиент с настроенными заголовками
 * @param url - URL GraphQL API
 * @param token - Токен авторизации (опционально)
 */
export const graphqlClientCreate = (url: string, token = ''): Client => {
  const exchanges = [fetchExchange, cacheExchange]
  const options: ClientOptions = {
    url,
    exchanges,
    fetchOptions: () => ({
      headers: {
        'content-type': 'application/json',
        accept: '*/*',
        origin: window?.location?.origin || '',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        ...(token ? { authorization: token } : {})
      },
      credentials: 'include',
      mode: 'cors'
    })
  }

  return createClient(options)
}

export const defaultClient: Client = graphqlClientCreate(coreApiUrl)
