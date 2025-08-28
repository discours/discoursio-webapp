import { gql } from 'graphql-tag'

export default gql`
  query ShoutsFollowedByUserQuery($slug: String!, $options: LoadShoutsOptions) {
    load_shouts_followed_by(slug: $slug, options: $options) {
      title
      subtitle
      layout
      slug
      cover
      main_topic { id slug title }
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
        views_count
        last_commented_at
        comments_count
        rating
      }
    }
  }
`
