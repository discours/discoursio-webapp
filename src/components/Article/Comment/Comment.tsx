import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, Suspense, createMemo, createSignal, lazy } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { ShowIfAuthenticated } from '~/components/_shared/ShowIfAuthenticated'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { useSnackbar, useUI } from '~/context/ui'
import {
  Author,
  MutationCreate_ReactionArgs,
  MutationUpdate_ReactionArgs,
  Reaction,
  ReactionKind
} from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { AuthorLink } from '../../Author/AuthorLink'
import { Userpic } from '../../Author/Userpic'
import { CommentDate } from '../CommentDate'
import { RatingControl } from '../RatingControl'
import styles from './Comment.module.scss'

const MiniEditor = lazy(() => import('../../Editor/MiniEditor'))

type Props = {
  comment: Reaction
  compact?: boolean
  isArticleAuthor?: boolean
  sortedComments?: Reaction[]
  lastSeen?: number
  class?: string
  showArticleLink?: boolean
  clickedReply?: (id: number) => void
  clickedReplyId?: number
  onDelete?: (id: number) => void
}

export const Comment = (props: Props) => {
  const { t } = useLocalize()
  const [isReplyVisible, setIsReplyVisible] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const [editMode, setEditMode] = createSignal(false)
  const [editedBody, setEditedBody] = createSignal<string>()
  const { session } = useSession()
  const author = createMemo<Author>(() => session()?.user?.app_data?.profile as Author)
  const { createShoutReaction, updateShoutReaction, deleteShoutReaction } = useReactions()
  const { showConfirm } = useUI()
  const { showSnackbar } = useSnackbar()
  const canEdit = createMemo(
    () =>
      Boolean(author()?.id) &&
      (props.comment?.created_by?.slug === author()?.slug || session()?.user?.roles?.includes('editor'))
  )

  const body = createMemo(() => (editedBody() ? editedBody()?.trim() : props.comment.body?.trim() || ''))

  const handleDelete = async () => {
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

  const handleCreate = async (value: string) => {
    try {
      setLoading(true)
      saveScrollPosition()
      await createShoutReaction({
        reaction: {
          kind: ReactionKind.Comment,
          reply_to: props.comment.id,
          body: value,
          shout: props.comment.shout.id
        }
      } as MutationCreate_ReactionArgs)
      setIsReplyVisible(false)
    } catch (error) {
      console.error('[handleCreate reaction]:', error)
    }
    setLoading(false)
    setTimeout(() => restoreScrollPosition(), 0)
  }

  const toggleEditMode = () => {
    setEditMode((oldEditMode) => !oldEditMode)
  }

  const handleUpdate = async (value: string) => {
    setLoading(true)
    saveScrollPosition()
    try {
      const reaction = await updateShoutReaction({
        reaction: {
          id: props.comment.id || 0,
          kind: ReactionKind.Comment,
          body: value,
          shout: props.comment.shout.id
        }
      } as MutationUpdate_ReactionArgs)

      if (reaction) {
        setEditedBody(value)
        setEditMode(false)
      }
    } catch (error) {
      console.error('[handleUpdate reaction]:', error)
    }
    setLoading(false)
    setTimeout(() => restoreScrollPosition(), 0)
  }

  const handleCancel = () => {
    saveScrollPosition()
    setEditMode(false)
    setTimeout(() => restoreScrollPosition(), 0)
  }

  return (
    <li
      id={`comment_${props.comment.id}`}
      class={clsx(styles.comment, props.class, {
        [styles.isNew]:
          (props.lastSeen || Date.now()) > (props.comment.updated_at || props.comment.created_at)
      })}
    >
      <Show when={!!body()}>
        <div class={styles.commentContent}>
          <Show
            when={!props.compact}
            fallback={
              <div>
                <Userpic
                  name={props.comment.created_by.name || ''}
                  userpic={props.comment.created_by.pic || ''}
                  class={clsx({
                    [styles.compactUserpic]: props.compact
                  })}
                />
                <small>
                  <a href={`#comment_${props.comment?.id}`}>{props.comment?.shout.title || ''}</a>
                </small>
              </div>
            }
          >
            <div class={styles.commentDetails}>
              <div class={styles.commentAuthor}>
                <AuthorLink author={props.comment?.created_by as Author} />
              </div>

              <Show when={props.isArticleAuthor}>
                <div class={styles.articleAuthor}>{t('Author')}</div>
              </Show>

              <Show when={props.showArticleLink}>
                <div class={styles.articleLink}>
                  <Icon name="arrow-right" class={styles.articleLinkIcon} />
                  <A href={`${props.comment.shout.slug}?commentId=${props.comment.id}`}>
                    {props.comment.shout.title}
                  </A>
                </div>
              </Show>
              <CommentDate showOnHover={true} comment={props.comment} isShort={true} />
              <RatingControl
                comment={props.comment}
                rated={props.comment.stat?.my_rate as ReactionKind | undefined}
              />
            </div>
          </Show>
          <div class={styles.commentBody}>
            <Show when={editMode()} fallback={<div innerHTML={body()} />}>
              <Suspense fallback={<p>{t('Loading')}</p>}>
                <MiniEditor
                  content={editedBody() || props.comment.body || ''}
                  placeholder={t('Write a comment...')}
                  onSubmit={(value) => handleUpdate(value)}
                  onCancel={handleCancel}
                />
              </Suspense>
            </Show>
          </div>

          <Show when={!props.compact}>
            <div>
              <ShowIfAuthenticated>
                <button
                  disabled={loading()}
                  onClick={() => {
                    setIsReplyVisible(!isReplyVisible())
                    props.clickedReply?.(props.comment.id)
                  }}
                  class={clsx(styles.commentControl, styles.commentControlReply)}
                >
                  <Icon name="reply" class={styles.icon} />
                  {loading() ? t('Loading') : t('Reply')}
                </button>
              </ShowIfAuthenticated>
              <Show when={canEdit()}>
                <button
                  class={clsx(styles.commentControl, styles.commentControlEdit)}
                  onClick={toggleEditMode}
                >
                  <Icon name="edit" class={styles.icon} />
                  {t('Edit')}
                </button>
                <button
                  class={clsx(styles.commentControl, styles.commentControlDelete)}
                  onClick={() => handleDelete()}
                >
                  <Icon name="delete" class={styles.icon} />
                  {t('Delete')}
                </button>
              </Show>

              {/*<SharePopup*/}
              {/*  title={'article.title'}*/}
              {/*  description={getDescription(body())}*/}
              {/*  containerCssClass={stylesHeader.control}*/}
              {/*  trigger={*/}
              {/*    <button class={clsx(styles.commentControl, styles.commentControlShare)}>*/}
              {/*      <Icon name="share" class={styles.icon} />*/}
              {/*      {t('Share')}*/}
              {/*    </button>*/}
              {/*  }*/}
              {/*/>*/}

              {/*<button*/}
              {/*  class={clsx(styles.commentControl, styles.commentControlComplain)}*/}
              {/*  onClick={() => showModal('reportComment')}*/}
              {/*>*/}
              {/*  {t('Complain')}*/}
              {/*</button>*/}
            </div>

            <Show when={isReplyVisible() && props.clickedReplyId === props.comment.id}>
              <Suspense fallback={<p>{t('Loading')}</p>}>
                <MiniEditor
                  placeholder={t('Write a comment...')}
                  onSubmit={(value) => handleCreate(value)}
                />
              </Suspense>
            </Show>
          </Show>
        </div>
      </Show>
      <Show when={props.sortedComments}>
        <ul>
          <For each={props.sortedComments?.filter((r) => r.reply_to === props.comment.id)}>
            {(c) => (
              <Comment
                sortedComments={props.sortedComments}
                isArticleAuthor={props.isArticleAuthor}
                comment={c}
                lastSeen={props.lastSeen}
                clickedReply={props.clickedReply}
                clickedReplyId={props.clickedReplyId}
              />
            )}
          </For>
        </ul>
      </Show>
    </li>
  )
}
