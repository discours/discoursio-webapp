import { gql } from 'graphql-tag'

export default gql`
  query LoadShoutsSearchQuery($text: String!, $options: LoadShoutsOptions) {
    load_shouts_search(text: $text, options: $options) {
      id
      title
      slug
      created_at
      cover
      main_topic { 
        id 
        slug 
        title 
      }
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
