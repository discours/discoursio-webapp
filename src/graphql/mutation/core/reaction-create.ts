import { gql } from 'graphql-tag'

export default gql`
  mutation CreateReactionMutation($reaction: ReactionInput!) {
    create_reaction(reaction: $reaction) {
      error
      reaction {
        id
        body
        kind
        created_at
        reply_to
        stat {
          rating
        }
        shout {
          id
          slug
        }
        created_by {
          name
          slug
          pic
        }
      }
    }
  }
`
