import { gql } from 'graphql-tag'

export default gql`
  query TopicsByCommunityQuery($community_id: Int!, $limit: Int, $offset: Int) {
    get_topics_by_community(community_id: $community_id, limit: $limit, offset: $offset) {
      title
      body
      slug
      pic
      # community
      stat {
        shouts
        authors
        followers
        comments
      }
    }
  }
`
