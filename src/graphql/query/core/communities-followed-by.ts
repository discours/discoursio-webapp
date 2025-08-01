import { gql } from 'graphql-tag'

export default gql`
  query LoadCommunitiesFollowedBy($slug: String, $author_id: Int) {
    get_communities_by_author(slug: $slug, author_id: $author_id) {
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
