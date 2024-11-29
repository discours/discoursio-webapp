import { gql } from 'graphql-tag'

export default gql`
  mutation ToggleBookmark($slug: String!) {
    toggle_bookmark_shout(slug: $slug) {
      error
    }
  }
`
