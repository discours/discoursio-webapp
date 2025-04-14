import { gql } from 'graphql-tag'

export default gql`
  mutation UnpublishDraftMutation($draft_id: Int!) {
    unpublish_draft(draft_id: $draft_id) {
      error
      draft {
        id
        slug
        title
        subtitle
        lead
        body
        media { url pic source artist title body date genre lyrics }
        topics { id title slug }
        authors { id name slug }
        created_at
        updated_at
      }
    }
  }
`
