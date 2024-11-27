import { gql } from 'graphql-tag'

export default gql`
  query CommentsMyRates($comments: [Int!]!) {
    get_my_rates_comments(comments: $comments) {
      comment_id
      my_rate
    }
  }
`
