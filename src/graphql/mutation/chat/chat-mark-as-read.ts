import { gql } from 'graphql-tag'

export default gql`
  mutation MarkAsReadMutation($message_id: Int!, $chat_id: String!) {
    mark_as_read(message_id: $message_id, chat_id: $chat_id) {
      error
    }
  }
`
