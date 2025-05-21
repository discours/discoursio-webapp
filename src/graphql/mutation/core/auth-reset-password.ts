import { gql } from '@urql/core'

export default gql`
  mutation ResetPassword($newPassword: String!, $token: String!) {
    resetPassword(newPassword: $newPassword, token: $token) {
      success
    }
  }
`
