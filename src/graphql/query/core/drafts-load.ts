import { gql } from 'graphql-tag'

export default gql`
  query LoadDraftsQuery {
    load_drafts {
        drafts {
            id
            title
            lead
            subtitle
            slug
            layout
            cover
            cover_caption
            body
            media { url pic source artist title body date genre lyrics }
            updated_by { id name slug pic created_at }
            topics { id title slug }
            authors { id name slug pic }
            created_at
            updated_at
        }
    }
}
`
