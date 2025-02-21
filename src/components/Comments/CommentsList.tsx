import { Reaction, ReactionSort } from '~/graphql/schema/core.gen'
import { createMemo, For, Show } from 'solid-js'
import { byCreated } from '~/utils/sort'
import { LoadMoreItems, LoadMoreWrapper } from '../_shared/LoadMoreWrapper'
import { CommentCard } from './CommentCard'

import styles from './CommentsList.module.scss'
import stylesArticle from '../Article/Article.module.scss'

export interface CommentsListProps {
  comments: Reaction[]
  loadMoreComments?: (offset: number) => Promise<LoadMoreItems | undefined>
  loadMoreHidden?: boolean
  pageSize?: number
  showArticleLink?: boolean
  withFilter?: boolean
  onDeleteComment?: (id: number) => void
  onFiltersChange?: (filters: { sort?: ReactionSort }) => void
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
      <Show when={props.comments.length > 0} fallback={<div>No comments yet</div>}>
        <LoadMoreWrapper
          loadFunction={props.loadMoreComments!}
          pageSize={props.pageSize || 10}
          hidden={props.loadMoreHidden}
        >
          <ul class={stylesArticle.comments}>
            <For each={sortedComments()}>
              {(comment) => (
                <CommentCard
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
