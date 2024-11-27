import { gql } from 'graphql-tag'

export default gql`
  query GetChatsQuery($limit: Int, $offset: Int) {
    load_chats(limit: $limit, offset: $offset) {
      error
      chats {
        id
        title
        admins
        members {
          id
          slug
          name
          pic
        }
        unread
        description
        updated_at
        messages {
          id
          body
          created_by
        }
      }
    }
  }
`
