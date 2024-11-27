import { gql } from 'graphql-tag'

export default gql`
  mutation CollabInviteAcceptMutation($invite_id: Int!) {
    accept_invite(invite_id: $invite_id) {
      error
    }
  }
`
