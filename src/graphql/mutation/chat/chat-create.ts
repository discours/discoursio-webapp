import { gql } from 'graphql-tag'

export default gql`
  mutation CreateChat($title: String, $members: [Int]!) {
    create_chat(title: $title, members: $members) {
      error
      chat {
        id
        members {
          id
          slug
        }
      }
    }
  }
`
