import { gql } from 'graphql-tag'

export default gql`
  mutation UnpublishShoutMutation($shout_id: Int!) {
    unpublish_shout(shout_id: $shout_id) {
      error
      shout {
        id
        slug
        title
        subtitle
        published_at
        featured_at
        updated_at
        created_at
      }
    }
  }
`
