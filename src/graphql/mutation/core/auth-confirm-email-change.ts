import { gql } from '@urql/core'

export default gql`
  mutation ConfirmEmailChange($token: String!) {
    confirmEmailChange(token: $token) {
      success
      error
      author {
        id
        name
        slug
        user
        email
        pic
        bio
        links
      }
    }
  }
`
