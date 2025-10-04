import { gql } from 'graphql-tag'

export default gql`
  mutation NotificationUnsubscribeThread($threadId: String!) {
    notification_unsubscribe_thread(thread_id: $threadId) {
      success
      error
    }
  }
`
