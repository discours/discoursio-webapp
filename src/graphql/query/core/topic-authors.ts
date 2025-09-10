import { gql } from 'graphql-tag'

export default gql`
  query TopicAuthorsQuery($slug: String!) {
    get_topic_authors(slug: $slug) {
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
      }
    }
  }
`
