import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { Accessor, JSX, Show, batch, createEffect, createMemo, createSignal, on, onMount } from 'solid-js'
import { RatingControl } from '~/components/RatingControl/RatingControl'
import { SimpleRichEditor } from '~/components/SimpleRichEditor/SimpleRichEditor'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { ShowIfAuthenticated } from '~/components/_shared/ShowIfAuthenticated'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { useSnackbar, useUI } from '~/context/ui'
import { loadCommentsMyRates } from '~/graphql/api/private'
import { Reaction, ReactionKind } from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { AuthorLink } from '../Author/AuthorLink'
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { CommentDate } from './CommentDate'

import styles from './CommentCard.module.scss'

type Props = {
  comment: Reaction
  compact?: boolean
  sortedComments?: Reaction[]
  lastSeen?: number
  class?: string
  showArticleLink?: boolean
  myRate?: ReactionKind
  onReply?: (id: number) => void
  clickedReplyId?: Accessor<number | undefined>
  onDelete?: (id: number) => void
  children?: JSX.Element
}

export const CommentCard = (props: Props) => {
  const { t } = useLocalize()
  const [isReplyVisible, setIsReplyVisible] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const [editMode, setEditMode] = createSignal(false)
  const [body, setEditedBody] = createSignal<string>()
  const { session, client } = useSession()
  const { deleteShoutReaction } = useReactions()
  const isArticleAuthor = createMemo(
    () => props.comment.created_by.slug === session()?.user?.app_data?.profile?.slug
  )
  const { showConfirm } = useUI()
  const { showSnackbar } = useSnackbar()
  const { setEditorContent } = useDrafts()
  const canEdit = createMemo(() => {
    const currentAuthor = session()?.user?.app_data?.profile
    return (
      Boolean(currentAuthor?.id) &&
      (props.comment.created_by.slug === currentAuthor.slug || session()?.user?.roles?.includes('editor'))
    )
  })

  const isNew = createMemo(() => {
    const lastSeen = props.lastSeen || Date.now()
    const commentDate = props.comment.updated_at || props.comment.created_at
    return lastSeen > commentDate
  })

  const handleDelete = async (ev?: MouseEvent) => {
    ev?.stopPropagation()
    if (props.comment?.id) {
      setLoading(true)
      saveScrollPosition()
      try {
        const isConfirmed = await showConfirm({
          confirmBody: t('Are you sure you want to delete this comment?'),
          confirmButtonLabel: t('Delete'),
          confirmButtonVariant: 'danger',
          declineButtonVariant: 'primary'
        })

        if (isConfirmed) {
          const result = await deleteShoutReaction(props.comment.id)
          const notificationType = result?.error ? 'error' : 'success'
          const notificationMessage = result?.error
            ? t('Failed to delete comment')
            : t('Comment successfully deleted')
          await showSnackbar({
            type: notificationType,
            body: notificationMessage,
            duration: 3
          })

          if (!result?.error && props.onDelete) {
            props.onDelete(props.comment.id)
          }
        }
      } catch (error) {
        await showSnackbar({ body: 'error' })
        console.error('[deleteReaction]', error)
      }
      setLoading(false)
      restoreScrollPosition()
    }
  }

  const toggleEditMode = () => {
    setEditMode((oldEditMode) => !oldEditMode)
  }

  const [commentsMyrates, setCommentsMyrates] = createSignal<Record<number, ReactionKind>>({})
  createEffect(
    on(
      [() => props.sortedComments, client],
      async ([ccc, api]) => {
        if (ccc) {
          const commentsRatesFetcher = loadCommentsMyRates(
            ccc.map((c) => c.id),
            api
          )
          const myratesData = await commentsRatesFetcher()
          const myrates = myratesData?.reduce(
            (acc, row) => {
              acc[row.comment] = row.my_rate
              return acc
            },
            {} as Record<number, ReactionKind>
          )
          myrates && setCommentsMyrates((prev) => ({ ...prev, ...myrates }))
        }
      },
      { defer: true }
    )
  )

  const handleReplySubmit = () => {
    if (!props.onReply) return

    batch(() => {
      setIsReplyVisible(false)
      props.onReply?.(props.comment.id)
      setEditorContent(`shout-${props.comment.shout.id}-comment-${props.clickedReplyId}`, body() || '')
    })
  }

  const handleReplyCancel = () => {
    batch(() => {
      setIsReplyVisible(false)
      setEditorContent(`shout-${props.comment.shout.id}-comment-${props.comment.id}`, '')
    })
  }

  const handleEditCancel = () => {
    console.log('handleEditCancel')
    setEditMode(false)
    setEditedBody(body())
  }

  const handleEditSubmit = () => {
    console.log('handleEditSubmit')
    setEditMode(false)
    setEditorContent(`shout-${props.comment.shout.id}-comment-${props.comment.id}`, body() || '')
  }

  onMount(() => {
    console.log('[CommentCard] Mounted:', {
      id: props.comment.id,
      body: props.comment.body,
      author: props.comment.created_by
    })
  })

  createEffect(() => {
    console.log('[CommentCard] Props updated:', {
      id: props.comment.id,
      hasBody: !!props.comment.body,
      sortedCommentsLength: props.sortedComments?.length
    })
  })

  const [isExpanded, setExpanded] = createSignal(true)
  return (
    <li
      id={`comment_${props.comment.id}`}
      class={clsx(styles.comment, props.class, {
        [styles.isNew]: isNew(),
        [styles.isReply]: !!props.comment.reply_to
      })}
    >
      <div class={styles.commentContent}>
        <div class={styles.commentHeader}>
          <div class={styles.authorInfo}>
            <AuthorLink author={props.comment.created_by} />
            <Show when={isArticleAuthor()}>
              <span class={styles.authorBadge}>{t('Author')}</span>
            </Show>
          </div>
          <CommentDate comment={props.comment} isShort={true} />
        </div>

        <div class={styles.commentBody}>
          <Show
            when={!editMode()}
            fallback={
              <SimpleRichEditor
                editorId={`edit-comment-${props.comment.id}`}
                content={props.comment.body || ''}
                placeholder={t('Edit comment...')}
                commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                onChange={(data) => setEditedBody(data.content)}
              />
            }
          >
            <div innerHTML={sanitizeHtml(props.comment.body || '')} />
          </Show>
        </div>

        <div class={styles.commentActions}>
          <RatingControl comment={props.comment} myRate={commentsMyrates()[props.comment.id]} />

          <ShowIfAuthenticated>
            <button
              class={clsx(styles.commentControl, styles.commentControlReply)}
              onClick={handleReplySubmit}
              disabled={loading()}
            >
              {loading() ? t('Loading...') : t('Reply')}
            </button>
          </ShowIfAuthenticated>

          <Show when={canEdit()}>
            <div class={styles.commentAuthorControls}>
              <button
                class={clsx(styles.commentControl, styles.commentControlEdit)}
                onClick={toggleEditMode}
                disabled={loading()}
              >
                <Icon name="edit" class={styles.icon} />
              </button>
              <Button
                variant="danger"
                onClick={() => handleDelete()}
                disabled={loading()}
                value={<Icon name="delete" class={styles.icon} />}
              />
            </div>
          </Show>

          <button
            class={clsx(styles.commentControl, styles.commentControlExpand)}
            onClick={() => setExpanded((e) => !e)}
          >
            <Icon name={isExpanded() ? 'collapse' : 'expand'} class={styles.icon} />
          </button>

          <Show when={isReplyVisible()}>
            <div class={styles.replyButtons}>
              <Button
                value={t('Cancel')}
                variant="secondary"
                onClick={handleReplyCancel}
                disabled={loading()}
              />
              <Button
                value={t('Reply')}
                variant="primary"
                onClick={handleReplySubmit}
                disabled={loading()}
              />
            </div>
          </Show>

          <Show when={editMode()}>
            <div class={styles.editButtons}>
              <Button
                value={t('Cancel')}
                variant="secondary"
                onClick={handleEditCancel}
                disabled={loading()}
              />
              <Button value={t('Save')} variant="primary" onClick={handleEditSubmit} disabled={loading()} />
            </div>
          </Show>
        </div>
      </div>

      <Show when={isExpanded()}>{props.children}</Show>

      <Show when={props.showArticleLink}>
        <div class={styles.articleLink}>
          <Icon name="arrow-right" class={styles.articleLinkIcon} />
          <A href={`/${props.comment.shout.slug}?commentId=${props.comment.id}`}>
            {props.comment.shout.title}
          </A>
        </div>
      </Show>
    </li>
  )
}
