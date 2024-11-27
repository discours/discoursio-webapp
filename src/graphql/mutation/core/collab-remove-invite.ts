import { gql } from 'graphql-tag'

export default gql`
  mutation CollabRemoveInviteMutation($invite_id: Int!) {
    remove_invite(invite_id: $invite_id) {
      error
    }
  }
`
