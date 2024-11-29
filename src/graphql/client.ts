import { type Client, type ClientOptions, cacheExchange, createClient, fetchExchange } from '@urql/core'
import { coreApiUrl } from '~/config'

// Функция для создания GraphQL клиента с заданным URL и токеном
const graphqlClientCreate = (url: string, token = ''): Client => {
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

const defaultClient = graphqlClientCreate(coreApiUrl)

export { type Client, defaultClient, graphqlClientCreate }
