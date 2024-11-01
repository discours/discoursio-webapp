import { gql } from '@urql/core'

export default gql`
  query LoadCoauthoredShoutsQuery($options: LoadShoutsOptions) {
    load_shouts_coauthored(options: $options) {
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
