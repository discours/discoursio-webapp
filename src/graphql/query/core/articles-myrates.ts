import { gql } from 'graphql-tag'

export default gql`
  query ArticlesMyRates($shouts: [Int!]!) {
    get_my_rates_shouts(shouts: $shouts) {
      shout_id
      my_rate
    }
  }
`
