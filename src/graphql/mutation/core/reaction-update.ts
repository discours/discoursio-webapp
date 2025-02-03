import { gql } from 'graphql-tag'

export default gql`
  mutation UpdateReactionMutation($reaction: ReactionInput!) {
    update_reaction(reaction: $reaction) {
      error
      reaction {
        id
        body
        kind
        updated_at
      }
    }
  }
`
