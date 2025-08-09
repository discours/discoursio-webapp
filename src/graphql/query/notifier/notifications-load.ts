import { gql } from 'graphql-tag'

export default gql`
  query LoadNotificationsQuery($after: Int!, $limit: Int, $offset: Int) {
    load_notifications(after: $after, limit: $limit, offset: $offset) {
      notifications {
        thread
        updated_at
        authors {
          id
          slug
          name
          pic
        }
        reactions {
          id
          kind
          created_at
          created_by { id slug name pic }
        }
        shout {
          id
          slug
          title
        }
      }
      unread
      total
    }
  }
`
