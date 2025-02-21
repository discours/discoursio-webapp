import {
  ErrorBoundary,
  For,
  Show,
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  untrack
} from 'solid-js'
import { useDrafts } from '~/context/drafts'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import {
  Author,
  MutationUpdate_ReactionArgs,
  Reaction,
  ReactionInput,
  ReactionKind,
  ReactionSort
} from '~/graphql/schema/core.gen'
import { SortFunction } from '~/types/common'
import { byCreated, byStat } from '~/utils/sort'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { Button } from '../_shared/Button'
import { Loading } from '../_shared/Loading'
import { ShowIfAuthenticated } from '../_shared/ShowIfAuthenticated'
import { CommentCard } from './CommentCard'
import { CommentsHeader } from './CommentsHeader'

import styles from './CommentsTree.module.scss'

type Props = {
  articleAuthors: Author[]
  shoutSlug: string
  shoutId: number
  onReply?: (id: number) => void
}

interface ErrorBoundaryError extends Error {
  message: string
}

export const CommentsTree = (props: Props) => {
  const { session } = useSession()
  const { t } = useLocalize()
  const { getEditorContent, setEditorContent } = useDrafts()
  const [onlyNew, setOnlyNew] = createSignal(false)
  const [clickedReplyId, setClickedReplyId] = createSignal<number>()
  const { reactionEntities, createShoutReaction, updateShoutReaction, loadReactionsBy } = useReactions()

  const [newReactions, setNewReactions] = createSignal<Reaction[]>([])
  const [commentsOrder, setCommentsOrder] = createSignal<ReactionSort>(ReactionSort.Newest)
  const [isLoading, setIsLoading] = createSignal(true)

  const comments = createMemo(() =>
    Object.values(reactionEntities()).filter((reaction) => reaction.kind === 'COMMENT')
  )

  const toggleNewOnly = () => setOnlyNew(!onlyNew())

  const sortedComments = createMemo(() => {
    let newSortedComments = [...comments()]
    newSortedComments = newSortedComments.sort(byCreated)

    if (onlyNew()) {
      return newReactions().sort(byCreated).reverse()
    }

    if (commentsOrder() === ReactionSort.Like) {
      newSortedComments = newSortedComments.sort(byStat('rating') as SortFunction<Reaction>)
    }
    return newSortedComments
  })
  const { seen } = useFeed()
  const shoutLastSeen = createMemo(() => seen()[props.shoutSlug] ?? 0)

  const [isFirstLoad, setIsFirstLoad] = createSignal(true)

  const [commentsResource, { refetch }] = createResource<Reaction[], string>(
    () => props.shoutSlug,
    async (slug: string) => {
      const response = await loadReactionsBy({
        by: {
          shout: slug,
          kinds: [ReactionKind.Comment]
        }
      })
      return response || []
    }
  )

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
        setNewReactions(newComments)
        localStorage?.setItem(`${props.shoutSlug}`, `${currentDate}`)
      }
      setIsFirstLoad(false)
      setIsLoading(false)
    }
  })

  const [posting, setPosting] = createSignal(false)
  const [replyTo, setReplyTo] = createSignal<number | null>(null)

  const handleSubmitCommentValue = async (value: string, commentId?: number) => {
    setPosting(true)
    try {
      // Sanitize content before sending
      const sanitizedContent = sanitizeHtml(value)

      if (commentId) {
        // Update existing comment
        const response = await updateShoutReaction({
          reaction: {
            id: commentId,
            kind: ReactionKind.Comment,
            body: sanitizedContent,
            shout: props.shoutId
          }
        } as MutationUpdate_ReactionArgs)

        if (response?.reaction) {
          // Update in the list
          setNewReactions((ccc: Reaction[]) =>
            (ccc as Reaction[]).map((c: Reaction) =>
              c.id === commentId ? (response.reaction as Reaction) : c
            )
          )
          setReplyTo(null)
          return true
        }
      } else {
        // Create new comment
        const createdReaction = await createShoutReaction({
          reaction: {
            kind: ReactionKind.Comment,
            body: sanitizedContent,
            shout: props.shoutId,
            reply_to: replyTo()
          } as ReactionInput
        })

        if (createdReaction) {
          setTimeout(() => setNewReactions([createdReaction, ...newReactions()]), 100)
          setReplyTo(null)
          return true
        }
      }

      return false
    } catch (error) {
      console.error('[handleSubmitCommentValue]:', error)
      return false
    } finally {
      setPosting(false)
    }
  }

  createEffect(
    on(
      () => getEditorContent(`draft-${props.shoutId}-comment-${clickedReplyId() || 'new'}`),
      (content) => {
        if (!content) return
        console.log('[CommentsTree] Editor content updated:', content)
      },
      { defer: true }
    )
  )

  const handleSubmitComment = async (commentId?: number) => {
    if (!getEditorContent(`draft-${props.shoutId}-comment-${clickedReplyId() || 'new'}`)) return

    setPosting(true)
    try {
      const success = await handleSubmitCommentValue(
        getEditorContent(`draft-${props.shoutId}-comment-${clickedReplyId() || 'new'}`),
        commentId
      )

      if (success) {
        batch(() => {
          setEditorContent(`draft-${props.shoutId}-comment-${clickedReplyId() || 'new'}`, '')
          setReplyTo(null)
        })
      }
      return success
    } catch (error) {
      console.error(error)
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

  const CommentsTreeItems = (props: Props) => (
    <ul class={styles.comments}>
      <For each={sortedComments().filter((r) => !r.reply_to)}>
        {(reaction) => (
          <CommentCard
            sortedComments={sortedComments()}
            isArticleAuthor={Boolean(props.articleAuthors.some((a) => a?.id === reaction.created_by.id))}
            comment={reaction}
            clickedReply={(id: number) => setClickedReplyId(id)}
            clickedReplyId={clickedReplyId()}
            lastSeen={shoutLastSeen()}
          />
        )}
      </For>
    </ul>
  )

  return (
    <ErrorBoundary
      fallback={(err: ErrorBoundaryError) => (
        <div class="error">
          <p>{err.message}</p>
          <button onClick={() => refetch()}>{t('Try again')}</button>
        </div>
      )}
    >
      <div>
        <Show when={!isLoading()} fallback={<Loading />}>
          <CommentsHeader
            comments={comments()}
            newComments={newReactions()}
            order={commentsOrder()}
            setOrder={setCommentsOrder}
            toggleNewOnly={toggleNewOnly}
            onlyNew={onlyNew()}
          />

          <Show when={!commentsResource.loading} fallback={<Loading />}>
            <Show when={commentsResource()} fallback={<div>{t('No comments yet')}</div>}>
              <CommentsTreeItems {...props} onReply={(id: number) => setReplyTo(id)} />
            </Show>
          </Show>

          <ShowIfAuthenticated fallback={<FallbackMessage />}>
            <div class={styles.editorWrapper}>
              <SimpleRichEditor
                commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                placeholder={replyTo() ? t('Write a reply...') : t('Write a comment...')}
                onChange={(data) => {
                  untrack(() =>
                    setEditorContent(
                      `draft-${props.shoutId}-comment-${clickedReplyId() || 'new'}`,
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
          </ShowIfAuthenticated>
        </Show>
      </div>
    </ErrorBoundary>
  )
}
