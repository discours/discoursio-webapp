import { gql } from 'graphql-tag'

export default gql`
  mutation CreateDraftMutation($draft_input: DraftInput!) {
    create_draft(draft_input: $draft_input) {
      error
      draft {
        id
        layout
      }
    }
  }
`
