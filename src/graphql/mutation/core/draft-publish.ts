import { gql } from 'graphql-tag'

export default gql`
  mutation PublishDraftMutation($draft_id: Int!) {
    publish_draft(draft_id: $draft_id) {
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
