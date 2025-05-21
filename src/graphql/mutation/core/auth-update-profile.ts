import { gql } from '@urql/core'

export default gql`
  mutation UpdateAuthor($profile: ProfileInput!) {
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
      }
    }
  }
`
