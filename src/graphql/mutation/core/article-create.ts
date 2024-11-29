import { gql } from 'graphql-tag'

export default gql`
  mutation CreateShoutMutation($shout: ShoutInput!) {
    create_shout(inp: $shout) {
      error
      shout {
        id
        slug
        title
        subtitle
        body
      }
    }
  }
`
