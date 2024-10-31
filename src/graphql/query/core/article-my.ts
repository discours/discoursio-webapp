import { gql } from '@urql/core'

export default gql`
    query GetMyShout($shout_id: Int!) {
        get_my_shout(shout_id: $shout_id) {
            error
            shout {
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
                media { url pic title body artist }
                updated_by {
                    id
                    name
                    slug
                    pic
                    created_at
                }
                # community
                main_topic { id slug }
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
            }
        }
    }
`
