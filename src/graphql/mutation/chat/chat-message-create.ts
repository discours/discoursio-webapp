import { gql } from 'graphql-tag'

export default gql`
  mutation createMessage($chat_id: String!, $body: String!, $reply_to: Int) {
    create_message(chat_id: $chat_id, body: $body, reply_to: $reply_to) {
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
