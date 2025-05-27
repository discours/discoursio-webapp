import { gql } from '@urql/core'

export default gql`
    mutation GetSession {
        getSession {
            author {
                    id
                    slug
                    name
                    pic
                    bio
                    links
                }
            token
        }
    }
`
