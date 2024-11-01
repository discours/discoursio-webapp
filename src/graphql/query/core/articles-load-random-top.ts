import { gql } from '@urql/core'

export default gql`
  query LoadRandomTopShoutsQuery($options: LoadShoutsOptions) {
    load_shouts_random_top(options: $options) {
      id
      title
      description
      subtitle
      slug
      layout
      cover
      cover_caption
      main_topic { id slug }
      created_by { id name slug pic created_at }
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
