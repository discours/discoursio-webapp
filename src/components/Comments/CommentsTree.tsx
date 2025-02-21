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
import {
  Author,
  MutationUpdate_ReactionArgs,
  Reaction,
  ReactionKind,
  ReactionSort
} from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { Button } from '../_shared/Button'
import { LoadMoreItems } from '../_shared/LoadMoreWrapper'
import { Loading } from '../_shared/Loading'
import { ShowIfAuthenticated } from '../_shared/ShowIfAuthenticated'
import { CommentCard } from './CommentCard'
import { CommentsHeader } from './CommentsHeader'

import styles from './CommentsTree.module.scss'

const COMMENTS_PER_PAGE = 20

type Props = {
  articleAuthors: Author[]
  shoutSlug: string
  shoutId: number
  onReply?: (id: number) => void
}

export const CommentsTree = (props: Props) => {
  const { session } = useSession()
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

  const comments = createMemo(() => {
    const allReactions = Object.values(reactionEntities())
    console.log('[CommentsTree] Filtering comments:', {
      total: allReactions.length,
      shoutSlug: props.shoutSlug,
      reactions: allReactions
    })
    return allReactions.filter((r) => r.kind === ReactionKind.Comment && r.shout?.slug === props.shoutSlug)
  })

  const toggleNewOnly = () => setOnlyNew(!onlyNew())

  const sortedComments = createMemo(() => {
    const currentComments = comments()
    console.log('[CommentsTree] Sorting comments:', {
      count: currentComments.length,
      comments: currentComments
    })

    if (!currentComments.length) return []

    let sorted: Reaction[]
    if (onlyNew()) {
      sorted = newComments().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    } else {
      sorted = [...currentComments].sort((a, b) => {
        if (commentsOrder() === ReactionSort.Like) {
          return (b.stat?.rating || 0) - (a.stat?.rating || 0)
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }

    return sorted
  })

  const commentTree = createMemo(() => {
    const sorted = sortedComments()
    console.log('[CommentsTree] Building tree:', {
      sortedCount: sorted.length,
      sorted
    })

    const tree: Record<number, Reaction[]> = {}

    sorted.forEach((comment) => {
      const parentId = comment.reply_to || 0
      if (!tree[parentId]) {
        tree[parentId] = []
      }
      tree[parentId].push(comment)
    })

    console.log('[CommentsTree] Tree built:', tree)
    return tree
  })

  const { seen } = useFeed()
  const shoutLastSeen = createMemo(() => seen()[props.shoutSlug] ?? 0)
  const [isFirstLoad, setIsFirstLoad] = createSignal(true)
  const [loadMoreHidden, setLoadMoreHidden] = createSignal(false)

  const [commentsResource, { refetch }] = createResource<Reaction[], string>(
    () => props.shoutSlug,
    async (slug: string) => {
      console.log('[CommentsTree] Loading comments for slug:', slug)
      setIsLoading(true)

      try {
        const response = await loadReactionsBy({
          by: {
            shout: slug,
            kinds: [ReactionKind.Comment]
          },
          limit: COMMENTS_PER_PAGE,
          offset: 0
        })

        console.log('[CommentsTree] Response:', {
          success: !!response,
          count: response?.length,
          data: response
        })

        if (response?.length) {
          batch(() => {
            addShoutReactions(response)
            setNewComments(response)
            setLoadMoreHidden(response.length < COMMENTS_PER_PAGE)
          })
        }

        return response || []
      } catch (error) {
        console.error('[CommentsTree] Error:', error)
        return []
      } finally {
        setIsLoading(false)
      }
    }
  )

  createEffect(() => {
    const entities = reactionEntities()
    console.log('[CommentsTree] Reactions updated:', {
      total: Object.keys(entities).length,
      forCurrentShout: comments()?.length
    })
  })

  createEffect(() => {
    if (!commentsResource.loading && commentsResource() && isFirstLoad()) {
      const currentDate = new Date()
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
    }
  })

  const [posting, setPosting] = createSignal(false)
  const [replyTo, setReplyTo] = createSignal<number | null>(null)

  const handleSubmitCommentValue = async (content: string, replyToId?: number) => {
    if (!content?.trim()) {
      await showSnackbar({ type: 'error', body: t('Comment cannot be empty') })
      return false
    }

    try {
      // Sanitize content before sending
      const sanitizedContent = sanitizeHtml(content)
      if (replyToId) {
        // Обновление существующего комментария
        const result = await updateShoutReaction({
          reaction: {
            body: sanitizedContent,
            shout: props.shoutId,
            kind: ReactionKind.Comment,
            reply_to: replyToId
          }
        } as MutationUpdate_ReactionArgs)

        if (result.error) {
          await showSnackbar({ type: 'error', body: t(result.error) })
          return false
        }
      } else {
        // Создание нового комментария
        const newComment = await createShoutReaction({
          reaction: {
            body: content,
            shout: props.shoutId,
            kind: ReactionKind.Comment
          }
        })

        if (!newComment) {
          await showSnackbar({ type: 'error', body: t('Failed to create comment') })
          return false
        }
      }

      await refetch()
      return true
    } catch (error) {
      console.error('[CommentsTree] Submit error:', error)
      await showSnackbar({ type: 'error', body: t('Failed to save comment') })
      return false
    }
  }

  const handleSubmitComment = async (commentId?: number) => {
    setPosting(true)
    try {
      const draftKey = `draft-${props.shoutId}-comment-${commentId || 'new'}`
      const content = getEditorContent(draftKey)

      const success = await handleSubmitCommentValue(content, commentId)

      if (success) {
        batch(() => {
          setEditorContent(draftKey, '')
          setReplyTo(null)
          setClickedReplyId(undefined)
        })
      }
      return success
    } catch (error) {
      console.error('[CommentsTree] Submit error:', error)
      return false
    } finally {
      setPosting(false)
    }
  }

  const handleClear = () => {
    batch(() => {
      setEditorContent(`draft-${props.shoutId}-comment-${clickedReplyId() || 'new'}`, '')
      setReplyTo(null)
    })
  }

  const handleReply = (commentId: number) => {
    batch(() => {
      setReplyTo(commentId)
      setClickedReplyId(commentId)
      // Очищаем предыдущий черновик
      setEditorContent(`draft-${props.shoutId}-comment-${commentId}-reply`, '')
    })
  }

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

  // TODO: use loadMoreComments
  const loadMoreComments = async (offset: number): Promise<LoadMoreItems | undefined> => {
    try {
      const response = await loadReactionsBy({
        by: {
          shout: props.shoutSlug,
          kinds: [ReactionKind.Comment]
        },
        limit: COMMENTS_PER_PAGE,
        offset
      })

      if (response?.length) {
        batch(() => {
          addShoutReactions(response)
          setLoadMoreHidden(response.length < COMMENTS_PER_PAGE)
        })

        return response as LoadMoreItems
      }
    } catch (error) {
      console.error('[CommentsTree] Error loading more comments:', error)
    }
    return undefined
  }

  const handleDelete = async (id: number) => {
    if (!id) return

    if (isLoading()) return

    setIsLoading(true)
    saveScrollPosition()

    try {
      let confirmed = false

      try {
        confirmed = await showConfirm({
          confirmBody: t('Are you sure you want to delete this comment?'),
          confirmButtonLabel: t('Delete'),
          confirmButtonVariant: 'danger',
          declineButtonVariant: 'primary'
        })
      } catch (error) {
        console.error('[CommentsTree] Confirm dialog error:', error)
        return
      }

      if (confirmed) {
        const result = await deleteShoutReaction(id)
        const notificationType = result?.error ? 'error' : 'success'
        const notificationMessage = result?.error
          ? t('Failed to delete comment')
          : t('Comment successfully deleted')

        await showSnackbar({
          type: notificationType,
          body: notificationMessage,
          duration: 3
        })

        if (!result?.error) {
          await refetch()
        }
      }
    } catch (error) {
      console.error('[CommentsTree] Delete error:', error)
      await showSnackbar({
        type: 'error',
        body: t('Failed to delete comment')
      })
    } finally {
      setIsLoading(false)
      restoreScrollPosition()
    }
  }

  const CommentBranch = (props: { parentId: number; shoutId: number }) => {
    const children = createMemo(() => commentTree()[props.parentId] || [])

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
                    untrack(() =>
                      setEditorContent(
                        `draft-${props.shoutId}-comment-${clickedReplyId()}-reply`,
                        data.content
                      )
                    )
                  }}
                  bubble={false}
                />
                <div class={styles.buttons}>
                  <Button value={t('Cancel')} variant="secondary" onClick={handleClear} />
                  <Button
                    value={posting() ? t('Saving...') : t('Save')}
                    variant="primary"
                    onClick={() => handleSubmitComment(clickedReplyId())}
                    disabled={posting()}
                  />
                </div>
              </div>
            </li>
          </Show>
          <For each={children()}>
            {(comment) => (
              <CommentCard
                comment={comment}
                sortedComments={sortedComments()}
                lastSeen={shoutLastSeen()}
                onDelete={handleDelete}
                onReply={handleReply}
                clickedReplyId={clickedReplyId}
              >
                <CommentBranch parentId={comment.id} shoutId={props.shoutId} />
              </CommentCard>
            )}
          </For>
        </ul>
      </Show>
    )
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
                    clickedReplyId={clickedReplyId}
                  >
                    <CommentBranch parentId={comment.id} shoutId={props.shoutId} />
                  </CommentCard>
                )}
              </For>
            </ul>
          </Show>

          <Show when={!clickedReplyId()}>
            <ShowIfAuthenticated fallback={<FallbackMessage />}>
              <div class={styles.editorButtonsWrapper}>
                <SimpleRichEditor
                  editorId={`draft-${props.shoutId}-comment-new`}
                  commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                  placeholder={t('Write a comment...')}
                  onChange={(data) => {
                    untrack(() => setEditorContent(`draft-${props.shoutId}-comment-new`, data.content))
                  }}
                />
                <div class={styles.buttons}>
                  <Button value={t('Cancel')} variant="secondary" onClick={handleClear} />
                  <Button
                    value={posting() ? t('Saving...') : t('Save')}
                    variant="primary"
                    onClick={() => handleSubmitComment()}
                    disabled={posting()}
                  />
                </div>
              </div>
            </ShowIfAuthenticated>
          </Show>
        </Show>
      </div>
    </ErrorBoundary>
  )
}
