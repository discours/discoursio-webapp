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
            topics { id title slug }
            authors { id name slug pic }
            publication { id slug published_at }
            created_at
            updated_at
        }
    }
}
`
