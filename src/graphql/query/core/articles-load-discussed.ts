import { gql } from 'graphql-tag'

export default gql`
  query LoadDiscussedShoutsQuery($options: LoadShoutsOptions) {
    load_shouts_discussed(options: $options) {
      id
      title
      lead
      subtitle
      slug
      layout
      cover
      cover_caption
      main_topic { id slug title }
      authors { id name slug pic created_at bio }
      created_at
      published_at
      featured_at
      stat {
        views_count
        last_commented_at
        rating
        comments_count
      }
    }
  }
`
