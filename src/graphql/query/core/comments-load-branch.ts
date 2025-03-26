import { gql } from '@urql/core'

// Запрос для загрузки ветки комментариев
export default gql`
  query LoadCommentsBranch(
    $shout: Int!,
    $parentId: Int,
    $limit: Int,
    $offset: Int,
    $sort: ReactionSort,
    $childrenLimit: Int,
    $childrenOffset: Int
  ) {
    load_comments_branch(
      shout: $shout,
      parent_id: $parentId,
      limit: $limit,
      offset: $offset,
      sort: $sort,
      children_limit: $childrenLimit,
      children_offset: $childrenOffset
    ) {
      id
      body
      created_at
      created_by {
        id
        name
        slug
        pic
      }
      kind
      reply_to
      stat {
        rating
        comments_count
      }
      shout {
        id
        slug
      }
      first_replies {
        id
        body
        created_at
        created_by {
          id
          name
          slug
          pic
        }
        kind
        reply_to
        stat {
          rating
          comments_count
        }
        shout {
          id
          slug
        }
      }
    }
  }
`
