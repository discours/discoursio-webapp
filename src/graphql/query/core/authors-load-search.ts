import { gql } from 'graphql-tag'

export default gql`
  query LoadAuthorsSearch($text: String!, $limit: Int, $offset: Int) {
    load_authors_search(text: $text, limit: $limit, offset: $offset) {
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
        rating_shouts
        rating_comments
        comments
        replies_count
        viewed_shouts
      }
    }
  }
`
