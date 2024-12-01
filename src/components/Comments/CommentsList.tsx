import { For, Show, createMemo } from 'solid-js'
import { Reaction, ReactionSort } from '~/graphql/schema/core.gen'
import { byCreated } from '~/utils/sort'
import { Comment } from '../Article/Comment'
import { LoadMoreItems, LoadMoreWrapper } from '../_shared/LoadMoreWrapper'
import { CommentsFilter } from './CommentsFilter'

import stylesArticle from '../Article/Article.module.scss'
import styles from './CommentsList.module.scss'

export interface CommentsListProps {
  comments: Reaction[]
  loadMoreComments?: (offset: number) => Promise<LoadMoreItems | undefined>
  loadMoreHidden?: boolean
  pageSize?: number
  showArticleLink?: boolean
  withFilter?: boolean
  onFiltersChange?: (filters: { sort?: ReactionSort }) => void
  onDeleteComment?: (id: number) => void
  sortOrder?: ReactionSort
}

export const CommentsList = (props: CommentsListProps) => {
  const sortedComments = createMemo(() => {
    const comments = [...props.comments]

    return props.sortOrder === ReactionSort.Like
      ? comments.sort((a, b) => (b.stat?.rating || 0) - (a.stat?.rating || 0))
      : comments.sort(byCreated).reverse()
  })

  return (
    <div class={styles.commentsList}>
      {props.withFilter && (
        <CommentsFilter onChange={props.onFiltersChange} currentSort={props.sortOrder} />
      )}

      <Show when={props.comments.length > 0} fallback={<div>No comments yet</div>}>
        <LoadMoreWrapper
          loadFunction={props.loadMoreComments!}
          pageSize={props.pageSize || 10}
          hidden={props.loadMoreHidden}
        >
          <ul class={stylesArticle.comments}>
            <For each={sortedComments()}>
              {(comment) => (
                <Comment
                  comment={comment}
                  showArticleLink={props.showArticleLink}
                  onDelete={props.onDeleteComment}
                />
              )}
            </For>
          </ul>
        </LoadMoreWrapper>
      </Show>
    </div>
  )
}
