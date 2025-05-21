import { gql } from '@urql/core'

export default gql`
  mutation Logout {
    logout {
      success
    }
  }
`
