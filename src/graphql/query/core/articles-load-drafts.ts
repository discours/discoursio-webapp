import { gql } from '@urql/core'

export default gql`
  query LoadDraftsQuery {
    get_shouts_drafts {
      error
      shouts {
        id
        title
        subtitle
        slug
        layout
        cover
        # community
        main_topic { id slug title }
        authors {
          id
          name
          slug
          pic
          created_at
        }
        created_at
        updated_at
        published_at
        featured_at
      }
    }
  }
`
