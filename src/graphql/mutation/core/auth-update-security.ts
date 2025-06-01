import { gql } from '@urql/core'

export default gql`
  mutation UpdateSecurity(
    $email: String
    $old_password: String
    $new_password: String
  ) {
    updateSecurity(
      email: $email
      old_password: $old_password
      new_password: $new_password
    ) {
      success
      error
    }
  }
`
