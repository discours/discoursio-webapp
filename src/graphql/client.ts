import { type Client, type ClientOptions, cacheExchange, createClient, fetchExchange } from '@urql/core'
import { DocumentNode } from 'graphql'
import { createResource as createSolidResource } from 'solid-js'
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
  return (args: V) => async () => {
    const resp = await client.query(query, getVariables(args)).toPromise()
    const key = Object.keys(resp?.data || {})[0]
    return resp?.data?.[key] as T
  }
}

/**
 * Создает реактивный ресурс для GraphQL запросов
 */
export const createQueryResource = <T, V>(
  query: GraphQLQuery,
  getVariables: (args: V) => Record<string, unknown>,
  client: Client = defaultClient
) => {
  const loader = createLoader<T, V>(query, getVariables, client)
  return (args: V) => createSolidResource(() => args, loader(args))
}

/**
 * Создает GraphQL клиент с опциональной авторизацией
 * Особенности:
 * - Поддержка токена авторизации
 * - Настройка кеширования через exchanges
 * - Конфигурация через options
 */
export const graphqlClientCreate = (url: string, token = ''): Client => {
  const exchanges = [fetchExchange, cacheExchange]
  const options: ClientOptions = {
    url,
    exchanges
  }

  if (token) {
    options.fetchOptions = () => ({
      headers: {
        'content-type': 'application/json',
        authorization: token
      }
    })
  }

  return createClient(options)
}

export const defaultClient: Client = graphqlClientCreate(coreApiUrl)
