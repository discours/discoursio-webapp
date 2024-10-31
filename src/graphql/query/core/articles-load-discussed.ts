import { gql } from '@urql/core'

export default gql`
  query LoadDiscussedShoutsQuery($limit: Int, $offset: Int) {
    load_shouts_discussed(limit: $limit, offset: $offset) {
      id
      title
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
