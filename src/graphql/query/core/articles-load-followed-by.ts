import { gql } from '@urql/core'

export default gql`
  query ShoutsFollowedByUserQuery($slug: String!, $limit: Int!, $offset: Int!) {
    load_shouts_followed_by(slug: String!, limit: Int, offset: Int) {
      title
      subtitle
      layout
      slug
      cover
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
      }
      created_at
      published_at
      featured_at
      stat {
        viewed
        last_reacted_at
        commented
        rating
      }
    }
  }
`
