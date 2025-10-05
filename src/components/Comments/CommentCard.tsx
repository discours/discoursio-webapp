import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { Accessor, createEffect, createMemo, createSignal, JSX, on, onMount, Show } from 'solid-js'
import { isServer } from 'solid-js/web'
import toast from 'solid-sonner'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { Loading } from '~/components/_shared/Loading'
import { Popup } from '~/components/_shared/Popup/Popup'
import { RatingControl } from '~/components/RatingControl/RatingControl'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import { Author, Reaction, ReactionKind } from '~/graphql/generated/graphql'
import { initCustomTags } from '~/utils/customTags'
import { saveScrollPosition } from '~/utils/scroll'
import { SharePopup } from '../Article/SharePopup'
import { AuthorLink } from '../Author/AuthorLink'
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { EditorData } from '../SimpleRichEditor/lib/types'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import styles from './CommentCard.module.scss'
import { CommentDate } from './CommentDate'
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
 * @property {string} [content] - Содержимое редактора при редактировании комментария
 * @property {Function} [onLoadReplies] - Обработчик загрузки ответов
 */
export type CommentCardProps = {
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
  onEditorChange?: (data: EditorData) => void
  onCancelEdit?: () => void
  onSaveEdit?: () => void
  onCancelReply?: () => void
  onSaveReply?: () => void
  onLoadReplies?: (id: number) => void
  children?: JSX.Element
  articleAuthors?: { slug: string }[]
  isNew?: boolean
  content?: string
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
  const { session } = useSession()
  const [isExpanded, setExpanded] = createSignal(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false)
  const [commentBodyRef, setCommentBodyRef] = createSignal<HTMLDivElement | undefined>()
  const [isDeleting, setIsDeleting] = createSignal(false)
  const [isAppearing, setIsAppearing] = createSignal(props.isNew || false)
  const [isEditing, setIsEditing] = createSignal(false)
  const [menuOpen, setMenuOpen] = createSignal(false)

  let commentRef: HTMLDivElement | undefined

  /**
   * Проверяет, может ли текущий пользователь редактировать комментарий
   */
  const canEdit = createMemo(() => {
    const currentAuthor = session()?.author
    return (
      Boolean(currentAuthor?.id) &&
      (props.comment.created_by?.slug === currentAuthor?.slug || session()?.author?.roles?.includes('editor'))
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
  const isAuthor = (author: Author) => {
    return props.articleAuthors?.some((a) => a.slug === author.slug) || false
  }

  /**
   * Проверяет, является ли автор комментария автором статьи
   */
  const isArticleAuthor = createMemo(() => {
    if (props.articleAuthors?.length && props.comment.created_by) {
      return isAuthor(props.comment.created_by)
    }
    return false
  })

  /**
   * Проверяет, удален ли комментарий
   */
  const isDeleted = createMemo(() => {
    return Boolean(props.comment.deleted_at)
  })

  // Обработка кастомных тегов (<tooltip>, <embed>) после рендеринга
  createEffect(
    on(
      commentBodyRef,
      () => {
        const ref = commentBodyRef()
        if (!ref || isServer) return

        // Инициализируем обработку кастомных тегов
        initCustomTags(ref)
      },
      { defer: true }
    )
  )

  /**
   * Проверяет, является ли комментарий локальным (еще не сохраненным на сервере)
   */
  const isLocalComment = createMemo(() => {
    const id = props.comment.id
    // Временные комментарии могут иметь отрицательные или очень большие ID (больше 1000000000)
    return id < 0 || id > 1000000000
  })

  onMount(() => {
    // Проверяем, является ли комментарий новым
    if (props.isNew) {
      setIsAppearing(true)
      setTimeout(() => {
        setIsAppearing(false)
      }, 2000)
    }

    // Устанавливаем ссылку на комментарий
    commentRef = document.getElementById(`comment-${props.comment.id}`) as HTMLDivElement
  })

  /**
   * Обработчик для удаления комментария
   */
  const handleDelete = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Показываем подтверждение в том же пункте меню
    setShowDeleteConfirm(true)
  }

  /**
   * Обработчик для подтверждения удаления комментария
   */
  const handleConfirmDelete = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Устанавливаем состояние удаления для визуальной индикации
    setIsDeleting(true)
    setMenuOpen(false) // Закрываем меню

    // Анимируем скрытие комментария перед фактическим удалением
    if (commentRef) {
      commentRef.style.transition = 'opacity 0.3s ease, max-height 0.5s ease, padding 0.5s ease, margin 0.5s ease'
      commentRef.style.opacity = '0'
      commentRef.style.maxHeight = '0'
      commentRef.style.overflow = 'hidden'
      commentRef.style.padding = '0'
      commentRef.style.margin = '0'
      commentRef.style.border = 'none'
    }

    // Вызываем удаление с небольшой задержкой для завершения анимации
    setTimeout(() => {
      props.onDelete?.(props.comment.id)
    }, 300)
  }

  /**
   * Обработчик для ответа на комментарий
   */
  const handleReply = () => {
    if (!session()?.token) {
      saveScrollPosition()
      showModal('auth')
      return
    }
    console.log('[CommentCard] Opening reply editor for comment:', props.comment.id)
    if (!props.onReply) {
      console.warn('[CommentCard] Reply handler not provided')
      return
    }
    // Не устанавливаем локальный флаг, так как форма отображается через CommentBranch
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
      toast.error(t('You cannot edit this comment'))
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

  const handleReport = () => {
    console.log('[CommentCard] Reporting comment:', props.comment.id)

    // TODO: Implement report handling
  }

  return (
    <div
      ref={commentRef}
      id={`comment-${props.comment.id}`}
      data-comment-id={props.comment.id}
      class={clsx(
        styles.comment,
        {
          [styles.rootComment]: !props.comment.reply_to,
          [styles.isNew]: isNew(),
          [styles.isReply]: props.compact,
          [styles.isDeleting]: isDeleting(),
          [styles.isAppearing]: isAppearing()
        },
        props.class
      )}
    >
      <Show when={isLocalComment()}>
        <div class={styles.loadingIndicator}>
          <Loading size="small" />
        </div>
      </Show>
      <Show when={isExpanded()} fallback={<hr onClick={() => setExpanded(true)} />}>
        <div class={styles.commentHeader}>
          <div class={styles.authorInfo}>
            <div>
              <Show when={props.comment.created_by && !isDeleted()}>
                <AuthorLink author={props.comment.created_by} />
                <Show when={isArticleAuthor()}>
                  <span class={styles.authorBadge}>{t('Author')}</span>
                </Show>
              </Show>
            </div>
          </div>
          <Show when={!isDeleted()}>
            <CommentDate comment={props.comment} isShort={true} />
          </Show>
        </div>

        {/* Тело комментария с возможностью редактирования */}
        <div class={clsx(styles.commentBody, { [styles.isEditing]: isEditing() })}>
          <Show
            when={!isEditing()}
            fallback={
              <div class={styles.editingContent}>
                <SimpleRichEditor
                  editorId={`draft-${props.comment.id}-edit`}
                  commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                  placeholder={t('Edit your comment...')}
                  onChange={(data) => {
                    console.log('[CommentCard] Editor onChange:', {
                      commentId: props.comment.id,
                      content: data.content,
                      isEmpty: data.isEmpty
                    })
                    props.onEditorChange?.(data)
                  }}
                  content={props.content || props.comment.body || ''}
                  toolbar="bottom"
                />
                <div
                  class={clsx(styles.editingButtonsWrapper, {
                    [styles.hidden]: props.content === '' || props.content === '<p><br></p>'
                  })}
                >
                  <Button
                    variant="secondary"
                    value={t('Cancel')}
                    onClick={() => {
                      // Сначала вызываем внешний обработчик, потом обновляем локальное состояние
                      props.onCancelEdit?.()
                      // Сбрасываем локальный флаг редактирования с небольшой задержкой для плавного перехода
                      setTimeout(() => setIsEditing(false), 50)
                    }}
                  />
                  <Button
                    value={t('Save')}
                    variant="primary"
                    onClick={() => {
                      // Сначала вызываем внешний обработчик, потом обновляем локальное состояние
                      props.onSaveEdit?.()
                      // Сбрасываем локальный флаг редактирования с небольшой задержкой для плавного перехода
                      setTimeout(() => setIsEditing(false), 50)
                    }}
                  />
                </div>
              </div>
            }
          >
            <div class={styles.commentContent}>
              <Show
                when={!isDeleted()}
                fallback={<p class={styles.deletedMessage}>{t('This comment has been deleted')}</p>}
              >
                {(() => {
                  const body = props.comment.body || ''
                  const sanitized = sanitizeHtml(body)
                  console.log('[CommentCard] Rendering comment body:', {
                    commentId: props.comment.id,
                    originalBody: body?.substring(0, 100),
                    sanitized: sanitized?.substring(0, 100),
                    bodyLength: body?.length,
                    sanitizedLength: sanitized?.length
                  })
                  return <div class={styles.commentText} innerHTML={String(sanitized)} ref={setCommentBodyRef} />
                })()}
              </Show>

              <div class={styles.commentActions}>
                <div class={styles.leftControls}>
                  <Show when={!isDeleted()}>
                    <RatingControl comment={props.comment} myRate={props.myRate} />
                    <button class={clsx(styles.commentControl, styles.commentControlReply)} onClick={handleReply}>
                      {t('Reply')}
                    </button>
                    <Show
                      when={
                        props.comment.stat?.comments_count && props.comment.stat.comments_count > 0 && !props.children
                      }
                    >
                      <button
                        class={clsx(styles.commentControl, styles.commentControlLoadReplies)}
                        onClick={() => props.onLoadReplies?.(props.comment.id)}
                      >
                        {t('Load replies')} ({props.comment.stat?.comments_count || 0})
                      </button>
                    </Show>
                  </Show>
                </div>

                <div class={styles.actionsSpacer} />

                <div class={styles.rightControls}>
                  <Show when={canEdit() && !isDeleted()}>
                    <button
                      class={clsx(styles.commentControl, styles.commentControlEdit)}
                      onClick={(e) => handleEdit(e)}
                      title={t('Edit comment')}
                    >
                      <Icon name="pencil-outline" class={styles.icon} />
                    </button>
                  </Show>

                  <Show when={!isDeleted()}>
                    <SharePopup
                      imageUrl={props.comment.created_by?.pic || ''}
                      trigger={
                        <button class={clsx(styles.commentControl, styles.commentControlShare)}>
                          <Icon name="share-outline" class={styles.icon} />
                        </button>
                      }
                      title={props.comment.body || ''}
                      description={`${props.comment.created_by?.name} ${t('commented on')} ${props.comment.shout?.title}`}
                      shareUrl={`${window.location.href}#comment-${props.comment.id}`}
                    />
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
                      keepOpen={showDeleteConfirm()}
                      onVisibilityChange={(visible) => {
                        setMenuOpen(visible)
                        if (!visible) {
                          // Сбрасываем подтверждение при закрытии меню
                          setShowDeleteConfirm(false)
                        }
                      }}
                      closePopup={!menuOpen()}
                    >
                      <div
                        class={styles.moreMenu}
                        onClick={(e) => {
                          // Предотвращаем закрытие меню при клике на его содержимое
                          e.stopPropagation()
                        }}
                      >
                        <Show
                          when={!showDeleteConfirm()}
                          fallback={
                            <button
                              class={clsx(styles.menuItem, styles.menuItemConfirm)}
                              onClick={(e) => {
                                e.stopPropagation() // Предотвращаем всплытие события
                                handleConfirmDelete(e)
                              }}
                              disabled={isDeleting()}
                              data-action="delete"
                            >
                              <Icon name="delete" class={styles.menuItemIcon} />
                              {t('Confirm deletion')}
                            </button>
                          }
                        >
                          {/* Стандартные пункты меню */}

                          {/* Кнопка удаления */}
                          <Show when={canEdit() && !isDeleted()}>
                            <button
                              class={styles.menuItem}
                              onClick={(e) => {
                                e.stopPropagation() // Предотвращаем всплытие события
                                handleDelete(e)
                              }}
                              disabled={isDeleting()}
                              data-action="delete"
                            >
                              <Icon name="delete" class={styles.menuItemIcon} />
                              {t('Delete')}
                            </button>
                          </Show>

                          {/* Кнопка жалобы (только для чужих комментариев и не-редакторов) */}
                          <Show
                            when={
                              // Комментарий принадлежит не текущему пользователю
                              session()?.author?.slug !== props.comment.created_by?.slug &&
                              // И текущий пользователь не редактор
                              !session()?.author?.roles?.includes('editor')
                            }
                          >
                            <button
                              class={styles.menuItem}
                              onClick={(e) => {
                                e.stopPropagation() // Предотвращаем всплытие события
                                handleReport()
                              }}
                              data-action="report"
                            >
                              <Icon name="red-megaphone" class={styles.menuItemIcon} />
                              {t('Report')}
                            </button>
                          </Show>
                        </Show>
                      </div>
                    </Popup>
                  </Show>
                </div>
              </div>

              <Show when={props.showArticleLink && props.comment.shout}>
                <A href={`/${props.comment.shout?.slug}`} class={styles.articleLink}>
                  <Icon name="article" class={styles.articleLinkIcon} />
                  {props.comment.shout?.title}
                </A>
              </Show>

              {/* Отображаем количество ответов из stat.comments_count */}
              <Show when={props.comment?.stat?.comments_count && props.comment.stat.comments_count > 0}>
                <div class={styles.repliesCount}>
                  <Icon name="comments" />
                  <span>{props.comment.stat?.comments_count}</span>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        {/* Дочерние комментарии всегда видимы */}
        <Show when={props.children}>
          <div class={styles.childComments}>{props.children}</div>
        </Show>
      </Show>
    </div>
  )
}
