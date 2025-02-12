import { gql } from 'graphql-tag'

export default gql`
  mutation UpdateDraftMutation($draft_id: Int!, $draft_input: DraftInput!) {
    update_draft(draft_id: $draft_id, draft_input: $draft_input) {
      error
      draft {
        id
        slug
        title
        subtitle
        lead
        description
        body
        media { url pic source artist title body date genre lyrics }
        topics {
          id
          title
          slug
        }
        authors {
          id
          name
          slug
        }
        created_at
        updated_at
      }
    }
  }
`
