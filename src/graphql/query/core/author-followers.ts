import { gql } from 'graphql-tag'

export default gql`
  query UserFollowingCountersQuery($slug: String, $author_id: Int) {
    get_author_followers(slug: $slug, author_id: $author_id) {
      id
      slug
      name
      pic
      bio
      created_at
      stat {
        shouts
        topics
      }
    }
  }
`
