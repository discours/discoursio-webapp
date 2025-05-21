import { gql } from '@urql/core'

export default gql`
  mutation ConfirmEmail($token: String!) {
    confirmEmail(token: $token) {
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
