import { gql } from '@urql/core'

export default gql`
  mutation GetSession {
    getSession {
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
      token
    }
  }
`
