import { gql } from '@urql/core'

export default gql`
    mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
        token
        author {
            id
            slug
            name
            pic
            bio
            links
        }
        success
        error
        }
    }
`
