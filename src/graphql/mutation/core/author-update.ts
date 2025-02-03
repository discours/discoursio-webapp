import { gql } from 'graphql-tag'

export default gql`
  mutation ProfileUpdateMutation($profile: ProfileInput!) {
    update_author(profile: $profile) {
      error
      author {
        id
        name
        slug
        bio
        about
        pic
        links
        created_at
        stat {
          followers
          comments
          shouts
        }
      }
    }
  }
`
