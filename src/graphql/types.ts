import type { Client } from '@urql/core'
export type { Client }

export interface GraphQLResponse<T> {
  data?: T
  error?: {
    message: string
  }
}
