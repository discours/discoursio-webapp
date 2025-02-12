import { gql } from 'graphql-tag'

export default gql`
  mutation CreateDraftMutation($input: DraftInput!) {
    create_draft(input: $input) {
      error
      draft {
        id
        slug
        title
        subtitle
        body
      }
    }
  }
`
