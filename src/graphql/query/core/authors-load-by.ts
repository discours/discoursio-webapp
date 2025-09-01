import { gql } from 'graphql-tag'

export default gql`
  query LoadAuthorsBy($by: AuthorsBy!, $limit: Int, $offset: Int) {
    load_authors_by(by: $by, limit: $limit, offset: $offset) {
      id
      slug
      name
      bio
      pic
      created_at
      stat {
        shouts
        coauthors
        followers
        replies_count
        viewed_shouts
        comments
        rating_shouts
        rating_comments
      }
    }
  }
`
