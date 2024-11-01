import { gql } from '@urql/core'

export default gql`
  query ShoutsFollowedByUserQuery($slug: String!, $options: LoadShoutsOptions) {
    load_shouts_followed_by(slug: $slug, options: $options) {
      title
      subtitle
      layout
      slug
      cover
      main_topic { id slug }
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
