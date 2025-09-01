import { gql } from 'graphql-tag'

export default gql`
  query TopicBySlugQuery($slug: String!) {
    get_topic(slug: $slug) {
      title
      body
      slug
      pic
      # community
      stat {
        shouts
        authors
        followers
      }
    }
  }
`
