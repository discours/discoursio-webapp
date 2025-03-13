import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { Accessor, JSX, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js'

import { RatingControl } from '~/components/RatingControl/RatingControl'
import { Icon } from '~/components/_shared/Icon'
import { Popup } from '~/components/_shared/Popup/Popup'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useSnackbar, useUI } from '~/context/ui'
import { Reaction, ReactionKind } from '~/graphql/schema/core.gen'
import { saveScrollPosition } from '~/utils/scroll'
import { AuthorLink } from '../Author/AuthorLink'
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { CommentDate } from './CommentDate'

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
 * @property {boolean} [isNew] - Флаг нового комментария для анимации
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
  isNew?: boolean
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
  const { showModal } = useUI()
  const { showSnackbar } = useSnackbar()
  const { session } = useSession()
  const [isExpanded, setExpanded] = createSignal(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false)
  const [isDeleting, setIsDeleting] = createSignal(false)
  const [isAppearing, setIsAppearing] = createSignal(props.isNew || false)
  const [isHidden, setIsHidden] = createSignal(false)
  const [isReplying, setIsReplying] = createSignal(false)
  const [isEditing, setIsEditing] = createSignal(false)

  let confirmRef: HTMLDivElement | undefined
  let commentRef: HTMLDivElement | undefined

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
    if (props.isNew) return true

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
    // Запускаем анимацию появления для новых комментариев
    if (props.isNew) {
      setIsAppearing(true)
      // Удаляем флаг "новый" через короткое время после анимации
      setTimeout(() => {
        setIsAppearing(false)
      }, 1000)
    }

    // При монтировании проверяем, был ли комментарий скрыт ранее
    const hiddenComments = JSON.parse(localStorage.getItem('hiddenComments') || '[]')
    setIsHidden(hiddenComments.includes(props.comment.id))

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
   * Обработчик для удаления комментария
   */
  const handleDelete = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!showDeleteConfirm()) {
      setShowDeleteConfirm(true)
      return
    }

    setIsDeleting(true)
    props.onDelete?.(props.comment.id)
  }

  /**
   * Обработчик для отмены удаления комментария
   */
  const handleCancelDelete = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDeleteConfirm(false)
  }

  /**
   * Обработчик для ответа на комментарий
   */
  const handleReply = () => {
    if (!session()?.access_token) {
      saveScrollPosition()
      showModal('auth')
      return
    }
    console.log('[CommentCard] Opening reply editor for comment:', props.comment.id)
    if (!props.onReply) {
      console.warn('[CommentCard] Reply handler not provided')
      return
    }
    setIsReplying(true)
    props.onReply(props.comment.id)
  }

  /**
   * Обработчик для редактирования комментария
   */
  const handleEdit = (ev: Event) => {
    ev.preventDefault()
    ev.stopPropagation()

    console.log('[CommentCard] Opening edit editor for comment:', props.comment.id)
    if (!canEdit()) {
      console.warn('[CommentCard] User cannot edit this comment')
      showSnackbar({ type: 'error', body: t('You cannot edit this comment') })
      return
    }

    setIsEditing(true)

    // Немедленно вызываем редактирование
    if (props.onEdit) {
      console.log('[CommentCard] Calling onEdit for comment:', props.comment.id)
      props.onEdit(props.comment.id)

      // Добавляем дополнительное логирование для отладки
      setTimeout(() => {
        console.log('[CommentCard] Edit callback completed for comment:', props.comment.id)
      }, 100)
    } else {
      console.warn('[CommentCard] Edit handler not provided')
    }
  }

  /**
   * Обработчик для шаринга комментария
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

  /**
   * Обработчик для скрытия комментария
   */
  const handleHide = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const hiddenComments = JSON.parse(localStorage.getItem('hiddenComments') || '[]')
    const updatedHiddenComments = [...hiddenComments, props.comment.id]
    localStorage.setItem('hiddenComments', JSON.stringify(updatedHiddenComments))

    setIsHidden(true)
    showSnackbar({ type: 'success', body: t('Comment hidden') })
  }

  /**
   * Обработчик для показа скрытого комментария
   */
  const handleUnhide = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const hiddenComments = JSON.parse(localStorage.getItem('hiddenComments') || '[]')
    const updatedHiddenComments = hiddenComments.filter((id: number) => id !== props.comment.id)
    localStorage.setItem('hiddenComments', JSON.stringify(updatedHiddenComments))

    setIsHidden(false)
    showSnackbar({ type: 'success', body: t('Comment unhidden') })
  }

  return (
    <div
      ref={commentRef}
      class={clsx(
        styles.comment,
        {
          [styles.rootComment]: !props.comment.reply_to,
          [styles.isNew]: isNew(),
          [styles.isReply]: props.compact,
          [styles.isDeleting]: isDeleting(),
          [styles.isAppearing]: isAppearing(),
          [styles.isHidden]: isHidden(),
          [styles.isEditing]: isEditing()
        },
        props.class
      )}
    >
      <Show
        when={!isHidden()}
        fallback={
          <div class={styles.hiddenComment} onClick={handleUnhide}>
            <Icon name="eye-off" class={styles.icon} />
            {t('Comment hidden')}
          </div>
        }
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
                  </Show>
                  <CommentDate comment={props.comment} isShort={true} />
                </div>
              </div>
            </div>

            <div class={styles.commentText} innerHTML={String(sanitizeHtml(props.comment.body || ''))} />

            <div class={styles.commentActions}>
              <div class={styles.leftControls}>
                <RatingControl comment={props.comment} myRate={props.myRate} />
                <button
                  class={clsx(styles.commentControl, styles.commentControlReply)}
                  onClick={handleReply}
                >
                  {t('Reply')}
                </button>
              </div>

              <div class={styles.actionsSpacer} />

              <div class={styles.rightControls}>
                <Show when={canEdit()}>
                  <button
                    class={clsx(styles.commentControl, styles.commentControlEdit)}
                    onClick={(e) => handleEdit(e)}
                    title={t('Edit comment')}
                  >
                    <Icon name="pencil-outline" class={styles.icon} />
                  </button>
                </Show>

                <button
                  class={clsx(styles.commentControl, styles.commentControlShare)}
                  onClick={() => handleShare()}
                >
                  <Icon name="share-outline" class={styles.icon} />
                </button>

                <Popup
                  trigger={
                    <button class={clsx(styles.commentControl, styles.commentControlMore)}>
                      <Icon name="ellipsis" class={styles.icon} />
                    </button>
                  }
                  variant="tiny"
                  horizontalAnchor="right"
                  containerCssClass={styles.moreMenuContainer}
                  popupCssClass={styles.moreMenuPopup}
                  onVisibilityChange={(isVisible) => {
                    console.log('[CommentCard] More menu visibility changed:', isVisible)
                  }}
                  closePopup={true}
                >
                  <div class={styles.moreMenu}>
                    <Show
                      when={isAuthor()}
                      fallback={
                        <button class={styles.menuItem} onClick={handleHide}>
                          <Icon name="eye-off" class={styles.menuItemIcon} />
                          {t('Hide comment')}
                        </button>
                      }
                    >
                      <button class={styles.menuItem} onClick={handleDelete} disabled={isDeleting()}>
                        <Icon name="delete" class={styles.menuItemIcon} />
                        {t('Delete')}
                      </button>
                      <Show when={showDeleteConfirm()}>
                        <div ref={confirmRef} class={styles.deleteConfirm}>
                          <button class={styles.cancelButton} onClick={handleCancelDelete}>
                            {t('Cancel')}
                          </button>
                          <button
                            class={styles.confirmButton}
                            onClick={handleDelete}
                            disabled={isDeleting()}
                          >
                            {t('Delete')}
                          </button>
                        </div>
                      </Show>
                    </Show>
                  </div>
                </Popup>
              </div>
            </div>

            <Show when={props.showArticleLink && props.comment.shout}>
              <A href={`/${props.comment.shout?.slug}`} class={styles.articleLink}>
                <Icon name="article" class={styles.articleLinkIcon} />
                {props.comment.shout?.title}
              </A>
            </Show>
          </div>

          <Show when={props.children}>
            <div class={clsx(styles.replyEditor, { [styles.isReplying]: isReplying() })}>
              {props.children}
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  )
}
