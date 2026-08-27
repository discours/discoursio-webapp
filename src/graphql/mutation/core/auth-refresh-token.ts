import { gql } from '@urql/core'

export default gql`
  mutation RefreshToken {
    refreshToken {
      token
      author {
        id
        slug
        user
        name
        email
        email_verified
        pic
        bio
        links
        roles
      }
      success
      error
    }
  }
`
