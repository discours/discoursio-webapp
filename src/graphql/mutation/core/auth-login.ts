import { gql } from '@urql/core'

export default gql`
    mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
            token
            author { id slug user name pic bio links email email_verified roles }
            success
            error
        }
    }
`
