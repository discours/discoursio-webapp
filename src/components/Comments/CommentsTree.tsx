import {
  ErrorBoundary,
  For,
  Show,
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  untrack
} from 'solid-js'
import { useDrafts } from '~/context/drafts'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { useSnackbar, useUI } from '~/context/ui'
import { useCommentsMyRates } from '~/graphql/api/private'
import {
  Author,
  MutationUpdate_ReactionArgs,
  Reaction,
  ReactionKind,
  ReactionSort
} from '~/graphql/schema/core.gen'
import { MutationCreate_ReactionArgs } from '~/graphql/schema/core.gen'
import { EditorData, SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { Button } from '../_shared/Button'
import { LoadMoreItems } from '../_shared/LoadMoreWrapper'
import { Loading } from '../_shared/Loading'
import { ShowIfAuthenticated } from '../_shared/ShowIfAuthenticated'
import { CommentCard } from './CommentCard'
import { CommentsHeader } from './CommentsHeader'

import clsx from 'clsx'
import styles from './CommentsTree.module.scss'

const COMMENTS_PER_PAGE = 20

/**
 * Параметры компонента дерева комментариев
 * @interface CommentsTreeProps
 * @property {Author[]} articleAuthors - Авторы статьи для определения специальных меток
 * @property {string} shoutSlug - Уникальный идентификатор статьи
 * @property {number} shoutId - ID статьи
 * @property {function} [onDeleteComment] - Callback при удалении комментария
 */
interface CommentsTreeProps {
  articleAuthors: Author[]
  shoutSlug: string
  shoutId: number
  onDeleteComment?: (id: number) => void
}

/**
 * Компонент дерева комментариев
 * Отображает иерархическую структуру комментариев с возможностью создания,
 * редактирования, удаления и ответов на комментарии.
 *
 * @component
 * @example
 * <CommentsTree
 *   articleAuthors={authors}
 *   shoutSlug="article-slug"
 *   shoutId={123}
 *   onDeleteComment={(id) => console.log('Comment deleted:', id)}
 * />
 */
export const CommentsTree = (props: CommentsTreeProps) => {
  const { session, client } = useSession()
  const { t } = useLocalize()
  const { getEditorContent, setEditorContent } = useDrafts()
  const [onlyNew, setOnlyNew] = createSignal(false)
  const [clickedReplyId, setClickedReplyId] = createSignal<number>()
  const {
    reactionEntities,
    createShoutReaction,
    updateShoutReaction,
    loadReactionsBy,
    addShoutReactions,
    deleteShoutReaction
  } = useReactions()
  const { showSnackbar } = useSnackbar()
  const [newComments, setNewComments] = createSignal<Reaction[]>([])
  const [commentsOrder, setCommentsOrder] = createSignal<ReactionSort>(ReactionSort.Newest)
  const [isLoading, setIsLoading] = createSignal(true)
  const { showConfirm } = useUI()

  // Состояния редактора
  const [editingCommentId, setEditingCommentId] = createSignal<number>()
  const [localContent, setLocalContent] = createSignal('')
  const [posting, setPosting] = createSignal(false)

  // Мемоизированные значения
  const comments = createMemo(() => {
    const allReactions = Object.values(reactionEntities())
    return allReactions.filter((r) => r.kind === ReactionKind.Comment && r.shout?.slug === props.shoutSlug)
  })

  const sortedComments = createMemo(() => {
    const currentComments = comments()
    if (!currentComments.length) return []

    if (onlyNew()) {
      return newComments().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }

    return [...currentComments].sort((a, b) => {
      if (commentsOrder() === ReactionSort.Like) {
        return (b.stat?.rating || 0) - (a.stat?.rating || 0)
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  })

  const commentTree = createMemo(() => {
    const sorted = sortedComments()
    const tree: Record<number, Reaction[]> = {}

    sorted.forEach((comment) => {
      const parentId = comment.reply_to || 0
      if (!tree[parentId]) tree[parentId] = []
      tree[parentId].push(comment)
    })

    return tree
  })

  // Загрузка комментариев
  const [commentsResource, { refetch }] = createResource(
    () => props.shoutSlug,
    async (slug) => {
      setIsLoading(true)
      try {
        const response = await loadReactionsBy({
          by: { shout: slug, kinds: [ReactionKind.Comment] },
          limit: COMMENTS_PER_PAGE,
          offset: 0
        })

        if (response?.length) {
          untrack(() => {
            addShoutReactions(response)
            setLoadMoreHidden(response.length < COMMENTS_PER_PAGE)
          })
        }

        return response || []
      } catch (error) {
        console.error('[CommentsTree] Error loading comments:', error)
        showSnackbar({ type: 'error', body: t('Failed to load comments') })
        return []
      } finally {
        setIsLoading(false)
      }
    }
  )

  // Загружаем рейтинги для всех комментариев сразу
  const [myRates, { refetch: refetchRates }] = useCommentsMyRates(
    comments().map((c) => c.id),
    client()
  )

  // Получаем рейтинг для конкретного комментария
  const getCommentRate = (commentId: number) => {
    const rates = myRates()
    if (!rates) return undefined
    const rate = rates.find((r: { comment: number; my_rate: ReactionKind }) => r.comment === commentId)
    return rate?.my_rate
  }

  // Обновляем рейтинги при изменении списка комментариев
  createEffect(() => {
    if (sortedComments().length > 0) {
      refetchRates()
    }
  })

  // Обработчики
  const handleSubmitComment = async (parentId?: number) => {
    if (!session()?.user) {
      showSnackbar({ type: 'error', body: t('Please sign in to comment') })
      return
    }

    const content = localContent().trim()
    if (!content) {
      showSnackbar({ type: 'error', body: t('Comment cannot be empty') })
      return
    }

    setPosting(true)
    const scrollPosition = window.scrollY

    try {
      const sanitizedContent = sanitizeHtml(content)
      const commentId = editingCommentId()
      const isEditing = commentId !== undefined

      const commentToEdit = isEditing ? comments().find((c) => c.id === commentId) : undefined
      if (isEditing && !commentToEdit) {
        showSnackbar({ type: 'error', body: t('Comment not found') })
        return
      }

      const input = isEditing
        ? ({
            reaction: {
              id: commentId,
              body: sanitizedContent,
              kind: ReactionKind.Comment,
              shout: props.shoutId,
              reply_to: commentToEdit?.reply_to
            }
          } as MutationUpdate_ReactionArgs)
        : ({
            reaction: {
              body: sanitizedContent,
              kind: ReactionKind.Comment,
              shout: props.shoutId,
              reply_to: parentId
            }
          } as MutationCreate_ReactionArgs)

      const result = isEditing ? await updateShoutReaction(input) : await createShoutReaction(input)

      if (result && 'error' in result && result.error) {
        showSnackbar({ type: 'error', body: result.error })
        return
      }

      handleClear()
      await refetch()
      showSnackbar({ type: 'success', body: t(isEditing ? 'Comment updated' : 'Comment saved') })
      window.scrollTo(0, scrollPosition)
    } catch (error) {
      console.error('[CommentsTree] Error submitting comment:', error)
      showSnackbar({ type: 'error', body: t('Failed to save comment') })
    } finally {
      setPosting(false)
    }
  }

  const handleClear = () => {
    const commentId = editingCommentId()
    const replyId = clickedReplyId()

    // Очищаем черновик
    const draftKey =
      commentId !== undefined
        ? `draft-${props.shoutId}-comment-edit-${commentId}`
        : replyId !== undefined
          ? `draft-${props.shoutId}-comment-${replyId}`
          : `draft-${props.shoutId}-comment-new`

    setEditorContent(draftKey, '')

    // Сбрасываем состояния атомарно
    batch(() => {
      setEditingCommentId(undefined)
      setClickedReplyId(undefined)
      setLocalContent('')
    })
  }

  const handleReply = (commentId: number) => {
    if (!commentId) return
    if (!session()?.user) {
      showSnackbar({ type: 'error', body: t('Please sign in to reply') })
      return
    }

    batch(() => {
      setClickedReplyId(commentId)
      setEditingCommentId(undefined)
      setLocalContent('')
      setEditorContent(`draft-${props.shoutId}-comment-${commentId}`, '')
    })
  }

  const handleEdit = (commentId: number) => {
    if (!commentId) return
    if (!session()?.user) {
      showSnackbar({ type: 'error', body: t('Please sign in to edit') })
      return
    }

    const commentToEdit = comments().find((c) => c.id === commentId)
    if (!commentToEdit) {
      showSnackbar({ type: 'error', body: t('Comment not found') })
      return
    }

    batch(() => {
      setEditingCommentId(commentId)
      setClickedReplyId(undefined)
      const content = commentToEdit.body || ''
      setLocalContent(content)
      setEditorContent(`draft-${props.shoutId}-comment-edit-${commentId}`, content)
    })
  }

  const handleDelete = async (id: number) => {
    if (!id) return
    if (!session()?.user) {
      showSnackbar({ type: 'error', body: t('Please sign in to delete') })
      return
    }

    const confirmed = await showConfirm({
      confirmBody: t('Are you sure you want to delete this comment?'),
      confirmButtonLabel: t('Delete'),
      confirmButtonVariant: 'danger',
      declineButtonLabel: t('Cancel')
    })

    if (!confirmed) return

    try {
      const result = await deleteShoutReaction(id)
      if (result?.error) {
        showSnackbar({ type: 'error', body: t('Failed to delete comment') })
        return
      }

      showSnackbar({ type: 'success', body: t('Comment deleted') })
      if (props.onDeleteComment) {
        props.onDeleteComment(id)
      }
      await refetch()
    } catch (error) {
      console.error('[CommentsTree] Error deleting comment:', error)
      showSnackbar({ type: 'error', body: t('Failed to delete comment') })
    }
  }

  const loadMoreComments = async (offset: number): Promise<LoadMoreItems | undefined> => {
    try {
      const response = await loadReactionsBy({
        by: { shout: props.shoutSlug, kinds: [ReactionKind.Comment] },
        limit: COMMENTS_PER_PAGE,
        offset
      })

      if (response?.length) {
        untrack(() => {
          addShoutReactions(response)
          setLoadMoreHidden(response.length < COMMENTS_PER_PAGE)
        })
        return response as LoadMoreItems
      }
    } catch (error) {
      console.error('[CommentsTree] Error loading more comments:', error)
      showSnackbar({ type: 'error', body: t('Failed to load more comments') })
    }
    return undefined
  }

  const toggleNewOnly = () => setOnlyNew(!onlyNew())

  const { seen } = useFeed()
  const shoutLastSeen = createMemo(() => seen()[props.shoutSlug] ?? 0)
  const [isFirstLoad, setIsFirstLoad] = createSignal(true)
  const [loadMoreHidden, setLoadMoreHidden] = createSignal(false)

  createEffect(() => {
    if (!commentsResource.loading && commentsResource() && isFirstLoad()) {
      const currentDate = new Date()
      untrack(() => {
        if (!shoutLastSeen()) {
          localStorage?.setItem(`${props.shoutSlug}`, `${currentDate}`)
        } else if (currentDate.getTime() > shoutLastSeen()) {
          const newComments = comments().filter((c) => {
            if (
              (session()?.user?.app_data?.profile?.id && c.reply_to) ||
              c.created_by.id === session()?.user?.app_data?.profile?.id
            ) {
              return
            }
            return (c.updated_at || c.created_at) > shoutLastSeen()
          })
          setNewComments(newComments)
          localStorage?.setItem(`${props.shoutSlug}`, `${currentDate}`)
        }
        setIsFirstLoad(false)
        setIsLoading(false)
      })
    }
  })

  const FallbackMessage = () => (
    <div class={styles.signInMessage}>
      {t('To write a comment, you must')}{' '}
      <a href="?m=auth&mode=register" class={styles.link}>
        {t('sign up')}
      </a>{' '}
      {t('or')}{' '}
      <a href="?m=auth&mode=login" class={styles.link}>
        {t('sign in')}
      </a>
    </div>
  )

  /**
   * Компонент ветки комментариев
   * Отображает дочерние комментарии и форму ответа
   */
  const CommentBranch = (props: { parentId: number; shoutId: number; articleAuthors?: Author[] }) => {
    console.log('[CommentBranch] Rendering branch:', {
      parentId: props.parentId,
      shoutId: props.shoutId
    })

    const children = createMemo(() => {
      const branch = commentTree()[props.parentId] || []
      console.log('[CommentBranch] Children:', {
        parentId: props.parentId,
        count: branch.length
      })
      return branch
    })

    return (
      <Show when={children().length > 0 || clickedReplyId() === props.parentId}>
        <ul class={styles.commentsList}>
          <Show when={clickedReplyId() === props.parentId}>
            <li class={styles.replyEditor}>
              <div class={styles.editorButtonsWrapper}>
                <SimpleRichEditor
                  editorId={`draft-${props.shoutId}-comment-${clickedReplyId()}`}
                  commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                  placeholder={t('Write a reply...')}
                  onChange={(data) => {
                    console.log('[CommentsTree] Reply editor onChange:', {
                      replyTo: clickedReplyId(),
                      content: data.content,
                      isEmpty: data.isEmpty
                    })
                    setLocalContent(data.content)
                    untrack(() =>
                      setEditorContent(`draft-${props.shoutId}-comment-${clickedReplyId()}`, data.content)
                    )
                  }}
                  content={getEditorContent(`draft-${props.shoutId}-comment-${clickedReplyId()}`)}
                  bubble={false}
                />
                <Show when={localContent().trim().length > 0}>
                  <div class={styles.buttons}>
                    <button class="button button--secondary" onClick={handleClear}>
                      {t('Cancel')}
                    </button>
                    <button
                      class="button button--primary"
                      onClick={() => handleSubmitComment(clickedReplyId() as number)}
                      disabled={posting()}
                    >
                      {t(posting() ? 'Saving...' : 'Save')}
                    </button>
                  </div>
                </Show>
              </div>
            </li>
          </Show>
          <For each={children()}>
            {(comment) => (
              <>
                <Show when={editingCommentId() !== comment.id}>
                  <CommentCard
                    comment={comment}
                    sortedComments={sortedComments()}
                    lastSeen={shoutLastSeen()}
                    onDelete={handleDelete}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    clickedReplyId={clickedReplyId}
                    articleAuthors={props.articleAuthors}
                    myRate={getCommentRate(comment.id)}
                  >
                    <CommentBranch
                      parentId={comment.id}
                      shoutId={props.shoutId}
                      articleAuthors={props.articleAuthors}
                    />
                  </CommentCard>
                </Show>
                <Show when={editingCommentId() === comment.id}>
                  <li class={styles.editingComment}>
                    <div class={styles.editorButtonsWrapper}>
                      <SimpleRichEditor
                        editorId={`draft-${props.shoutId}-comment-edit-${comment.id}`}
                        commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                        placeholder={t('Edit your comment...')}
                        onChange={(data) => {
                          console.log('[CommentsTree] Edit editor onChange:', {
                            commentId: comment.id,
                            content: data.content,
                            isEmpty: data.isEmpty,
                            plainText: data.plainText
                          })
                          setLocalContent(data.content)
                          untrack(() =>
                            setEditorContent(
                              `draft-${props.shoutId}-comment-edit-${comment.id}`,
                              data.content
                            )
                          )
                        }}
                        content={getEditorContent(`draft-${props.shoutId}-comment-edit-${comment.id}`)}
                        bubble={false}
                      />
                      <div
                        class={clsx(styles.buttons, {
                          [styles.buttonsActive]: localContent().trim().length > 0
                        })}
                      >
                        <button class="button button--secondary" onClick={handleClear}>
                          {t('Cancel')}
                        </button>
                        <button
                          class="button button--primary"
                          onClick={() => handleSubmitComment(undefined)}
                          disabled={posting()}
                        >
                          {t(posting() ? 'Saving...' : 'Save')}
                        </button>
                      </div>
                    </div>
                  </li>
                </Show>
              </>
            )}
          </For>
        </ul>
      </Show>
    )
  }

  const handleEditorChange = (data: EditorData) => {
    console.log('[CommentsTree] New comment editor onChange:', {
      content: data.content,
      isEmpty: data.isEmpty
    })
    setLocalContent(data.content)
    untrack(() => setEditorContent(`draft-${props.shoutId}-comment-new`, data.content))
  }

  return (
    <ErrorBoundary fallback={(err) => <div>Error: {err.toString()}</div>}>
      <div class={styles.comments}>
        <Show when={!isLoading()} fallback={<Loading />}>
          <CommentsHeader
            comments={comments()}
            newComments={newComments()}
            order={commentsOrder()}
            setOrder={setCommentsOrder}
            onlyNew={onlyNew()}
            toggleNewOnly={toggleNewOnly}
          />

          <Show when={comments().length > 0}>
            <ul class={styles.commentsList}>
              <For each={commentTree()[0] || []}>
                {(comment) => (
                  <CommentCard
                    comment={comment}
                    sortedComments={sortedComments()}
                    lastSeen={shoutLastSeen()}
                    onDelete={handleDelete}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    clickedReplyId={clickedReplyId}
                    articleAuthors={props.articleAuthors}
                    myRate={getCommentRate(comment.id)}
                  >
                    <CommentBranch
                      parentId={comment.id}
                      shoutId={props.shoutId}
                      articleAuthors={props.articleAuthors}
                    />
                  </CommentCard>
                )}
              </For>
            </ul>
          </Show>

          <Show when={!loadMoreHidden() && comments().length >= COMMENTS_PER_PAGE}>
            <div class={styles.loadMoreContainer}>
              <Button
                variant="secondary"
                onClick={() => loadMoreComments(comments().length)}
                value={t('Load more comments')}
              />
            </div>
          </Show>

          <Show when={!clickedReplyId()}>
            <ShowIfAuthenticated fallback={<FallbackMessage />}>
              <div class={styles.editorButtonsWrapper}>
                <SimpleRichEditor
                  editorId={`draft-${props.shoutId}-comment-new`}
                  commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                  placeholder={t('Write a comment...')}
                  onChange={handleEditorChange}
                  content={getEditorContent(`draft-${props.shoutId}-comment-new`)}
                />
                <div
                  class={clsx(styles.newCommentButtons, {
                    [styles.buttonsActive]: localContent().trim().length > 0
                  })}
                >
                  <button
                    class={clsx('button', 'button--secondary', {
                      [styles.buttonsActive]: localContent().trim().length > 0
                    })}
                    onClick={handleClear}
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    class={clsx('button', 'button--primary', {
                      [styles.buttonsActive]: localContent().trim().length > 0
                    })}
                    onClick={() => handleSubmitComment(undefined)}
                    disabled={posting()}
                  >
                    {t(posting() ? 'Saving...' : 'Save')}
                  </button>
                </div>
              </div>
            </ShowIfAuthenticated>
          </Show>
        </Show>
      </div>
    </ErrorBoundary>
  )
}
