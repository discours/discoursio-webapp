import { gql } from 'graphql-tag'

export default gql`
  query LoadShoutQuery($slug: String, $shout_id: Int) {
    get_shout(slug: $slug, shout_id: $shout_id) {
      id
      title
      lead
      description
      subtitle
      slug
      layout
      cover
      cover_caption
      body
      media { url pic source artist title body date genre lyrics }
      updated_by {
        id
        name
        slug
        pic
        created_at
      }
      # community
      topics {
        id
        title
        body
        slug
        stat {
          shouts
          authors
          followers
        }
      }
      authors {
        id
        name
        slug
        pic
        created_at
      }
      created_at
      updated_at
      published_at
      featured_at
      stat {
        viewed
        rating
        commented
      }
    }
  }
`
