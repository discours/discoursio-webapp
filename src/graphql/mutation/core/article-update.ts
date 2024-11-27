import { gql } from 'graphql-tag'

export default gql`
  mutation UpdateShoutMutation($shout_id: Int!, $shout_input: ShoutInput, $publish: Boolean) {
    update_shout(shout_id: $shout_id, shout_input: $shout_input, publish: $publish) {
      error
      shout {
        id
        slug
        title
        subtitle
        lead
        description
        body
        authors { id name slug }
        topics { id title slug}
        created_at
        updated_at
        published_at
        featured_at
      }
    }
  }
`
