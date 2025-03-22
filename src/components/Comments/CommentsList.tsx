import { For, Show, createMemo } from 'solid-js'
import { batch, createSignal, untrack } from 'solid-js'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { Reaction, ReactionSort } from '~/graphql/schema/core.gen'
import { byCreated } from '~/utils/sort'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { Button } from '../_shared/Button'
import { LoadMoreItems, LoadMoreWrapper } from '../_shared/LoadMoreWrapper'
import { CommentCard } from './CommentCard'

import stylesArticle from '../Article/Article.module.scss'
import { EditorData } from '../SimpleRichEditor/SimpleRichEditor'
import styles from './CommentsList.module.scss'

export interface CommentsListProps {
  comments: Reaction[]
  loadMoreComments?: (offset: number) => Promise<LoadMoreItems | undefined>
  loadMoreHidden?: boolean
  pageSize?: number
  showArticleLink?: boolean
  withFilter?: boolean
  onDeleteComment?: (id: number) => void
  onFiltersChange?: (filters: { sort?: ReactionSort }) => void // TODO: use or remove
  sortOrder?: ReactionSort
}

const CommentsFiltersBar = () => {
  return <div>{/* TODO: CommentsFiltersBar */}</div>
}

export const CommentsList = (props: CommentsListProps) => {
  const { t } = useLocalize()
  const { getEditorContent, setEditorContent } = useDrafts()
  const [replyTo, setReplyTo] = createSignal<number | null>(null)
  const [clickedReplyId, setClickedReplyId] = createSignal<number>()

  const handleReply = (commentId: number) => {
    batch(() => {
      setReplyTo(commentId)
      setClickedReplyId(commentId)
      // Очищаем предыдущий черновик если есть
      const draftKey = `draft-comment-${commentId}`
      if (getEditorContent(draftKey)) {
        setEditorContent(draftKey, '')
      }
    })
  }

  const sortedComments = createMemo(() => {
    const comments = [...props.comments]

    return props.sortOrder === ReactionSort.Like
      ? comments.sort((a, b) => (b.stat?.rating || 0) - (a.stat?.rating || 0))
      : comments.sort(byCreated).reverse()
  })

  return (
    <div class={styles.commentsList}>
      <Show
        when={props.comments.length > 0}
        fallback={<div class={styles.noComments}>{t('No comments yet')}</div>}
      >
        <Show when={props.onFiltersChange}>
          <CommentsFiltersBar />
        </Show>
        <LoadMoreWrapper
          loadFunction={props.loadMoreComments!}
          pageSize={props.pageSize || 10}
          hidden={props.loadMoreHidden}
          useScrollTrigger={true}
        >
          <ul class={stylesArticle.comments}>
            <For each={sortedComments()}>
              {(comment) => (
                <CommentCard
                  comment={comment}
                  showArticleLink={props.showArticleLink}
                  onDelete={props.onDeleteComment}
                  onReply={handleReply}
                  clickedReplyId={clickedReplyId}
                >
                  <Show when={replyTo() === comment.id}>
                    <div class={styles.replyEditor}>
                      <SimpleRichEditor
                        toolbar="bottom"
                        editorId={`draft-comment-${comment.id}`}
                        placeholder={t('Write a reply...')}
                        commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                        onChange={(data: EditorData) => {
                          untrack(() => setEditorContent(`draft-comment-${comment.id}`, data.content))
                        }}
                      />
                      <div class={styles.replyButtons}>
                        <Button
                          value={t('Cancel')}
                          variant="secondary"
                          onClick={(ev?: MouseEvent) => {
                            ev?.stopPropagation()
                            setReplyTo(null)
                          }}
                        />
                        <Button
                          value={t('Reply')}
                          variant="primary"
                          onClick={() => {
                            // TODO: Implement reply submission
                            setReplyTo(null)
                          }}
                        />
                      </div>
                    </div>
                  </Show>
                </CommentCard>
              )}
            </For>
          </ul>
        </LoadMoreWrapper>
      </Show>
    </div>
  )
}
