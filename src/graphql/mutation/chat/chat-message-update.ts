import { gql } from 'graphql-tag'

export default gql`
  mutation UpdateMessage($message: MessageInput!) {
    update_message(message: $message) {
      error
      message {
        id
        body
        created_by
        created_at
        reply_to
        updated_at
      }
    }
  }
`
