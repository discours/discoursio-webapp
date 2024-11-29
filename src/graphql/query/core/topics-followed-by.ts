import { gql } from 'graphql-tag'

export default gql`
  query LoadTopicsFollowedBy($slug: String, $user: String, $author_id: Int) {
    get_topics_by_author(slug: $slug, user: $user, author_id: $author_id) {
      id
      slug
      title
      body
      pic
      # community
      stat {
        shouts
        followers
        authors
      }
    }
  }
`
