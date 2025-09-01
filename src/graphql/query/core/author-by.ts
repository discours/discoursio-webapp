import { gql } from 'graphql-tag'

export default gql`
  query GetAuthorBy($slug: String, $author_id: Int) {
    get_author(slug: $slug, author_id: $author_id) {
      id
      slug
      name
      bio
      about
      pic
      # communities
      links
      created_at
      last_seen
      stat {
        shouts
        coauthors
        followers
        rating_shouts
        rating_comments
        comments
        replies_count
        viewed_shouts
        topics
      }
    }
  }
`
