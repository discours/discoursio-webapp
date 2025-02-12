import { gql } from 'graphql-tag'

export default gql`
  mutation CommunityUpdateMutation($community_input: CommunityInput!) {
    update_community(community_input: $community_input) {
      error
      community {
        id
        slug
        desc
        name
        pic
        created_at
        created_by {
          id
          slug
          name
          pic
        }
      }
    }
  }
`
