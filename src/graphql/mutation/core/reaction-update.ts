import { gql } from 'graphql-tag'

export default gql`
  mutation UpdateReactionMutation($reaction: ReactionInput!) {
    update_reaction(reaction: $reaction) {
      error
      reaction {
        id
        body
        updated_at
        reply_to
        created_by {
          id
          name
          slug
        }
        shout {
          id
          title
          slug
        }
      }
    }
  }
`
