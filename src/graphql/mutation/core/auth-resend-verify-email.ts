import { gql } from '@urql/core'

export default gql`
  mutation ResendVerifyEmail($email: String!) {
    sendLink(email: $email, template: "verification") {
      id
    }
  }
`
