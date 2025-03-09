import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { Accessor, JSX, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js'
import { RatingControl } from '~/components/RatingControl/RatingControl'
import { Icon } from '~/components/_shared/Icon'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useSnackbar, useUI } from '~/context/ui'
import { Reaction, ReactionKind } from '~/graphql/schema/core.gen'
import { AuthorLink } from '../Author/AuthorLink'
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { CommentDate } from './CommentDate'

import { saveScrollPosition } from '~/utils/scroll'
import styles from './CommentCard.module.scss'

/**
 * Свойства компонента CommentCard
 * @typedef {Object} CommentCardProps
 * @property {Reaction} comment - Объект комментария для отображения
 * @property {boolean} [compact] - Флаг компактного отображения
 * @property {Reaction[]} [sortedComments] - Отсортированный список комментариев
 * @property {number} [lastSeen] - Временная метка последнего просмотра для определения новых комментариев
 * @property {string} [class] - Дополнительные CSS классы
 * @property {boolean} [showArticleLink] - Флаг отображения ссылки на статью
 * @property {ReactionKind} [myRate] - Оценка текущего пользователя для комментария
 * @property {Function} [onReply] - Обработчик ответа на комментарий
 * @property {Accessor<number | undefined>} [clickedReplyId] - ID комментария, на который отвечают
 * @property {Function} [onDelete] - Обработчик удаления комментария
 * @property {Function} [onEdit] - Обработчик редактирования комментария
 * @property {JSX.Element} [children] - Дочерние элементы
 * @property {Author[]} [articleAuthors] - Авторы статьи
 */
type CommentCardProps = {
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
  onEdit?: (id: number) => void
  children?: JSX.Element
  articleAuthors?: { slug: string }[]
}

/**
 * Компонент карточки комментария
 *
 * Отображает комментарий с информацией об авторе, текстом, датой и элементами управления.
 * Поддерживает редактирование, удаление, ответы на комментарии и оценки.
 *
 * @example
 * ```tsx
 * <CommentCard
 *   comment={commentData}
 *   onReply={(id) => handleReply(id)}
 *   onDelete={(id) => handleDelete(id)}
 *   onEdit={(id) => handleEdit(id)}
 * />
 * ```
 *
 * @param {CommentCardProps} props - Свойства компонента
 * @returns {JSX.Element} Элемент карточки комментария
 */
export const CommentCard = (props: CommentCardProps): JSX.Element => {
  const { t } = useLocalize()
  const { showConfirm, showModal } = useUI()
  const { showSnackbar } = useSnackbar()
  const { session } = useSession()
  const [isExpanded, setExpanded] = createSignal(true)
  /**
   * Проверяет, может ли текущий пользователь редактировать комментарий
   */
  const canEdit = createMemo(() => {
    const currentAuthor = session()?.user?.app_data?.profile
    return (
      Boolean(currentAuthor?.id) &&
      (props.comment.created_by?.slug === currentAuthor?.slug || session()?.user?.roles?.includes('editor'))
    )
  })

  /**
   * Определяет, является ли комментарий новым для пользователя
   */
  const isNew = createMemo(() => {
    const lastSeen = props.lastSeen || Date.now()
    const commentDate = props.comment.updated_at || props.comment.created_at
    return lastSeen - commentDate < 1000 * 60 * 1
  })

  /**
   * Проверяет, является ли текущий пользователь автором комментария
   */
  const isAuthor = createMemo(() => {
    return props.comment.created_by?.slug === session()?.user?.app_data?.profile?.slug
  })

  /**
   * Проверяет, является ли автор комментария автором статьи
   */
  const isArticleAuthor = createMemo(() => {
    if (props.articleAuthors?.length && props.comment.created_by) {
      return props.articleAuthors.some((author) => author.slug === props.comment.created_by?.slug)
    }
    return false
  })

  onMount(() => {
    console.log('[CommentCard] Mounted:', {
      id: props.comment.id,
      body: props.comment.body,
      author: props.comment.created_by || 'unknown'
    })
  })

  createEffect(() => {
    console.log('[CommentCard] Props updated:', {
      id: props.comment.id,
      hasBody: !!props.comment.body,
      sortedCommentsLength: props.sortedComments?.length
    })
  })

  /**
   * Обработчик для удаления комментария с подтверждением
   */
  const handleDelete = async (ev?: MouseEvent) => {
    ev?.preventDefault()
    if (!canEdit()) {
      console.warn('[CommentCard] User cannot delete this comment')
      showSnackbar({ type: 'error', body: t('You cannot delete this comment') })
      return
    }
    if (!props.onDelete) {
      console.warn('[CommentCard] Delete handler not provided')
      return
    }

    console.log('[CommentCard] Attempting to delete comment:', props.comment.id)

    const confirmed = await showConfirm({
      confirmBody: t('Are you sure you want to delete this comment?'),
      confirmButtonLabel: t('Delete'),
      confirmButtonVariant: 'danger',
      declineButtonLabel: t('Cancel'),
      declineButtonVariant: 'secondary'
    })

    if (confirmed) {
      props.onDelete(props.comment.id)
    } else {
      console.log('[CommentCard] Delete cancelled')
    }
  }

  /**
   * Обработчик для показа редактора в режиме ответа
   */
  const handleReply = () => {
    if (!session()?.access_token) {
      saveScrollPosition() // TODO: call restoreScrollPosition() after modal is closed
      showModal('auth')
      return
    }
    console.log('[CommentCard] Opening reply editor for comment:', props.comment.id)
    if (!props.onReply) {
      console.warn('[CommentCard] Reply handler not provided')
      return
    }
    props.onReply(props.comment.id)
  }

  /**
   * Обработчик для показа редактора в режиме редактирования
   */
  const handleEdit = () => {
    console.log('[CommentCard] Opening edit editor for comment:', props.comment.id)
    if (!canEdit()) {
      console.warn('[CommentCard] User cannot edit this comment')
      showSnackbar({ type: 'error', body: t('You cannot edit this comment') })
      return
    }
    if (!props.onEdit) {
      console.warn('[CommentCard] Edit handler not provided')
      return
    }
    props.onEdit(props.comment.id)
  }

  /**
   * Обработчик для показа шаринга комментария
   */
  const handleShare = () => {
    console.log('[CommentCard] Opening share dialog for comment:', props.comment.id)
    const commentUrl = `${window.location.href}#comment-${props.comment.id}`

    if (navigator.share) {
      navigator
        .share({
          title: t('Share comment'),
          text: props.comment.body || '',
          url: commentUrl
        })
        .catch((error) => {
          console.error('[CommentCard] Share error:', error)
          // Fallback to clipboard if share fails
          handleClipboardCopy(commentUrl)
        })
    } else {
      handleClipboardCopy(commentUrl)
    }
  }

  /**
   * Вспомогательная функция для копирования в буфер обмена
   */
  const handleClipboardCopy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showSnackbar({ type: 'success', body: t('Link copied to clipboard') })
      })
      .catch((error) => {
        console.error('[CommentCard] Copy error:', error)
        showSnackbar({ type: 'error', body: t('Failed to copy link') })
      })
  }
  return (
    <div
      class={clsx(
        styles.comment,
        {
          [styles.rootComment]: !props.comment.reply_to,
          [styles.isNew]: isNew(),
          [styles.isReply]: props.compact
        },
        props.class
      )}
    >
      <Show when={isExpanded()} fallback={<hr onClick={() => setExpanded(true)} />}>
        <div class={styles.commentContent}>
          <div class={styles.commentHeader}>
            <div class={styles.authorInfo}>
              <div>
                <Show when={props.comment.created_by}>
                  <AuthorLink author={props.comment.created_by} />
                  <Show when={isArticleAuthor()}>
                    <span class={styles.authorBadge}>{t('Author')}</span>
                  </Show>
                  <Show when={isAuthor()}>
                    <span class={styles.authorBadge}>{t('Your comment')}</span>
                  </Show>
                </Show>
                <CommentDate comment={props.comment} isShort={true} />
              </div>
            </div>
          </div>

          <div class={styles.commentText} innerHTML={sanitizeHtml(props.comment.body || '')} />

          <div class={styles.commentActions}>
            <div class={styles.leftControls}>
              <RatingControl comment={props.comment} myRate={props.myRate} />
              <button class={clsx(styles.commentControl, styles.commentControlReply)} onClick={handleReply}>
                {t('Reply')}
              </button>
            </div>

            <div class={styles.actionsSpacer} />

            <div class={styles.rightControls}>
              <button class={clsx(styles.commentControl, styles.commentControlShare)} onClick={handleShare}>
                <Icon name="share" class={styles.icon} />
              </button>
              <Show when={canEdit()}>
                <button class={clsx(styles.commentControl, styles.commentControlEdit)} onClick={handleEdit}>
                  <Icon name="edit" class={styles.icon} />
                </button>

                <button
                  class={clsx(styles.commentControl, styles.commentControlDelete)}
                  onClick={handleDelete}
                >
                  <Icon name="delete" class={styles.icon} />
                </button>
              </Show>
            </div>
          </div>

          <Show when={props.showArticleLink && props.comment.shout}>
            <A href={`/${props.comment.shout?.slug}`} class={styles.articleLink}>
              <Icon name="article" class={styles.articleLinkIcon} />
              {props.comment.shout?.title}
            </A>
          </Show>
        </div>

        {props.children}
      </Show>
    </div>
  )
}
