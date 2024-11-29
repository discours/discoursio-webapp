import { gql } from 'graphql-tag'

export default gql`
  mutation CollabRemoveAuthorMutation($author_id: Int!, $slug: String!) {
    remove_author(author_id: $author_id, slug: $slug) {
      error
    }
  }
`
