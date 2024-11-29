import { gql } from 'graphql-tag'

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
      main_topic { id slug title }
      authors {
        id
        name
        slug
        pic
        created_at
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
