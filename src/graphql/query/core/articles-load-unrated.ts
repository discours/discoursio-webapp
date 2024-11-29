import { gql } from 'graphql-tag'

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
      created_by {
        id
        name
        slug
        pic
        created_at
      }
    }
  }
`
