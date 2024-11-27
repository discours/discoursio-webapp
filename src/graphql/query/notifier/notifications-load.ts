import { gql } from 'graphql-tag'

export default gql`
  query LoadNotificationsQuery($after: Int!, $limit: Int, $offset: Int) {
    load_notifications(after: $after, limit: $limit, offset: $offset) {
      notifications {
        id
        updated_at
        authors {
          id
          slug
          name
          pic
        }
        reactions
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
