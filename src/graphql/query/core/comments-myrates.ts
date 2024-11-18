import { gql } from '@urql/core'

export default gql`
  query CommentsMyRates($comments: [Int]!, $shout: Int!) {
    get_my_rates_comments(comments: $comments, shout: $shout) {
      comment_id
      my_rate
    }
  }
`
