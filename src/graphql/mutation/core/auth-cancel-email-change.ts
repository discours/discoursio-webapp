import { gql } from '@urql/core'

export default gql`
  mutation CancelEmailChange {
    cancelEmailChange {
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
