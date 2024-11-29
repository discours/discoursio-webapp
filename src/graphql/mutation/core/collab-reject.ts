import { gql } from 'graphql-tag'

export default gql`
  mutation CollabInviteRejectMutation($invite_id: Int!) {
    reject_invite(invite_id: $invite_id) {
      error
    }
  }
`
