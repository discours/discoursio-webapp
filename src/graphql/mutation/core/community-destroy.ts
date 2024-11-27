import { gql } from 'graphql-tag'

export default gql`
  mutation CommunityDestroyMutation($slug: String!) {
    delete_community(slug: $slug) {
      error
    }
  }
`
