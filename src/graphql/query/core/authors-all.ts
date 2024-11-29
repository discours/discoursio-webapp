import { gql } from 'graphql-tag'

export default gql`
  query GetAuthorsAllQuery {
    get_authors_all {
      id
      slug
      name
      bio
      pic
      created_at
    }
  }
`
