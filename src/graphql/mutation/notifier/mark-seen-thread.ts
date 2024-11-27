import { gql } from 'graphql-tag'

export default gql`
  mutation MarkThreadSeen($thread: String!, $after: Int) {
    mark_seen_thread(thread: $thread, after: $after) {
      error
    }
  }
`
