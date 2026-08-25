import { gql } from '@urql/core'

export default gql`
    mutation RegisterUser($email: String!, $password: String!, $name: String) {
        registerUser(email: $email, password: $password, name: $name) {
        token
        author {
            id
            slug
            user
            name
            email
            pic
            bio
            links
        }
        success
        error
        }
    }
`
