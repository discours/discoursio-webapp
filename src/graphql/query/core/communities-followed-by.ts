import { gql } from 'graphql-tag'

export default gql`
  query LoadCommunitiesFollowedBy($slug: String, $user: String, $author_id: Int) {
    get_communities_by_author(slug: $slug, user: $user, author_id: $author_id) {
      id
      slug
      name
      pic
      stat {
        shouts
        followers
        authors
      }
    }
  }
`
