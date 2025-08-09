import { gql } from '@urql/core'

export default gql`
  mutation GetSession {
    getSession {
      author {
        id
        slug
        name
        email
        pic
        bio
        links
      }
      token
    }
  }
`
