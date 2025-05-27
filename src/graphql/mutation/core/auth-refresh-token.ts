import { gql } from '@urql/core'

export default gql`
  mutation RefreshToken {
    refreshToken {
      token
      author {
        id
        slug
        name
        pic
        bio
        links
      }
      success
      error
    }
  }
`
