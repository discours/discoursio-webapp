import { gql } from 'graphql-tag'

export default gql`
  mutation CreateDraftFromShoutMutation($shout_id: Int!) {
    create_draft_from_shout(shout_id: $shout_id) {
      error
      draft {
        id
        slug
        title
        subtitle
        lead
        body
        media { url pic source artist title body date genre lyrics }
        topics { id title slug }
        authors { id name slug }
        layout
        shout
        cover
        cover_caption
        seo
        lang
        created_at
      }
    }
  }
`
