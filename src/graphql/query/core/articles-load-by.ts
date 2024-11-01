import { gql } from '@urql/core'

export default gql`
  query LoadShoutsQuery($options: LoadShoutsOptions) {
    load_shouts_by(options: $options) {
      id
      title
      description
      subtitle
      slug
      layout
      cover
      lead
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
