import { gql } from 'graphql-tag'

export default gql`
  mutation MarkNotificationAsReadMutation($notificationId: Int!) {
    mark_seen(notification_id: $notificationId) {
      error
    }
  }
`
