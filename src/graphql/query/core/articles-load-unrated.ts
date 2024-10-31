import { gql } from '@urql/core'

export default gql`
  query LoadUnratedShoutsQuery($limit: Int, $offset: Int) {
    load_shouts_unrated(limit: $limit, offset: $offset) {
      id
      title
      slug
      layout
      cover
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
