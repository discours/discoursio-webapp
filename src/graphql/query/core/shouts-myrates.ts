import { gql } from '@urql/core'

export const shoutsMyRatesQuery = gql`
  query ShoutsMyRates($shouts: [Int!]!) {
    shouts_my_rates(shouts: $shouts) {
      shout_id
      my_rate
    }
  }
`
