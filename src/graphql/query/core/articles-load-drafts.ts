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
        media
        main_topic { id slug }
        topics {
          id
          title
          body
          slug
          stat {
            shouts
            authors
            followers
          }
        }
        authors {
          id
          name
          slug
          pic
          created_at
        }
        created_at
        published_at
        featured_at
        stat {
          viewed
          last_reacted_at
          rating
          commented
        }
      }
    }
  }
`
