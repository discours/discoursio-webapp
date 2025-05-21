import { gql } from '@urql/core'

export default gql`
  query IsEmailUsed($email: String!) {
    isEmailUsed(email: $email)
  }
`
