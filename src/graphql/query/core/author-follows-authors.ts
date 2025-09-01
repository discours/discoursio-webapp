import { gql } from 'graphql-tag'

export default gql`
  query GetAuthorFollowsAuthors($slug: String, $user: String, $author_id: Int) {
    get_author_follows_authors(slug: $slug, user: $user, author_id: $author_id) {
        id
        slug
        name
        pic
        bio
        created_at
        stat {
          shouts
          coauthors
          followers
          topics
        }
    }
  }
`
