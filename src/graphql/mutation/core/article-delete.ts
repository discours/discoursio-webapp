import { gql } from 'graphql-tag'

export default gql`
  mutation DeleteShoutMutation($shout_id: Int!) {
    delete_shout(shout_id: $shout_id) {
      error
    }
  }
`
