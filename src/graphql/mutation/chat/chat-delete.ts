import { gql } from 'graphql-tag'

export default gql`
  mutation DeleteChat($chat_id: String!) {
    delete_chat(chat_id: $chat_id) {
      error
    }
  }
`
