import { gql } from '@urql/core'

export default gql`
  query LoadReactions($by: ReactionBy!, $limit: Int, $offset: Int) {
    load_reactions_by(by: $by, limit: $limit, offset: $offset) {
      id
      kind
      body
      reply_to
      shout {
        id
        slug
        title
      }
      created_by {
        name
        slug
        pic
        created_at
      }
      created_at
      updated_at
      stat {
        rating
      }
    }
  }
`
