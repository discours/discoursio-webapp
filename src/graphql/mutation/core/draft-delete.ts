import { gql } from 'graphql-tag'

export default gql`
  mutation DeleteDraftMutation($draft_id: Int!) {
    delete_draft(draft_id: $draft_id) {
      error
    }
  }
`
