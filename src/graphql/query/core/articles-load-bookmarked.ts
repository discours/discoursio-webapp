import { gql } from '@urql/core'

export default gql`
  query LoadBookmarkedShoutsQuery($options: LoadShoutsOptions) {
    load_shouts_bookmarked(options: $options) {
      id
      title
      description
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
        rating
        commented
      }
    }
  }
`
