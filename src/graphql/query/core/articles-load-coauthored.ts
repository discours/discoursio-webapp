import { gql } from '@urql/core'

export default gql`
  query LoadCoauthoredShoutsQuery($limit: Int, $offset: Int) {
    load_shouts_coauthored(limit: $limit, offset: $offset) {
      id
      title
      # lead
      description
      subtitle
      slug
      layout
      cover
      cover_caption
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
        bio
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
`
