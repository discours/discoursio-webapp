import { gql } from '@urql/core'

export default gql`
  query LoadUnratedShoutsQuery($options: LoadShoutsOptions) {
    load_shouts_unrated(options: $options) {
      id
      title
      subtitle
      slug
      layout
      cover
      main_topic { id slug title }
      authors {
        id
        name
        slug
        pic
        created_at
        bio
      }
    }
  }
`
