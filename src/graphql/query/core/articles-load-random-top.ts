import { gql } from 'graphql-tag'

export default gql`
  query LoadRandomTopShoutsQuery($options: LoadShoutsOptions) {
    load_shouts_random_top(options: $options) {
      id
      title
      lead
      subtitle
      slug
      layout
      cover
      cover_caption
      main_topic { id slug title }
      created_by { id name slug pic created_at }
      created_at
      published_at
      featured_at
      stat {
        viewed
        last_commented_at
        rating
        comments_count
      }
    }
  }
`
