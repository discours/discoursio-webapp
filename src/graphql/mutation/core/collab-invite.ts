import { gql } from 'graphql-tag'

export default gql`
  mutation CollabInviteCreateMutation($author_id: Int!, $slug: String!) {
    create_invite(author_id: $author_id, slug: $slug) {
      error
    }
  }
`
