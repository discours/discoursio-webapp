import { gql } from '@urql/core'

export default gql`
  query LoadShoutsSearchQuery($text: String!, $options: LoadShoutsOptions) {
    load_shouts_search(text: $text, options: $options) {
      score
      title
      slug
      created_at
      cover
      main_topic { id slug title }
      authors {
        slug
        name
        pic
        created_at
        last_seen
      }
    }
  }
`
