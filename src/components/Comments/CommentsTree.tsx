import clsx from 'clsx'
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
import { useSnackbar } from '~/context/ui'
import { useCommentsMyRates } from '~/graphql/api/private'
import {
  Author,
  MutationUpdate_ReactionArgs,
  Reaction,
  ReactionKind,
  ReactionSort
} from '~/graphql/schema/core.gen'
import { MutationCreate_ReactionArgs } from '~/graphql/schema/core.gen'
import { COMMENTS_PER_PAGE } from '../Article/FullArticle'
import { EditorData, SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { cleanupContent, sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { Button } from '../_shared/Button'
import { LoadMoreItems } from '../_shared/LoadMoreWrapper'
import { Loading } from '../_shared/Loading'
import { ShowIfAuthenticated } from '../_shared/ShowIfAuthenticated'
import { CommentCard } from './CommentCard'
import { CommentsHeader } from './CommentsHeader'

import styles from './CommentsTree.module.scss'

/**
 * Сохраняет и восстанавливает позицию скролла при изменениях в DOM
 * @param callback - Функция, которая выполняет изменения DOM
 */
const withPreservedScroll = (callback: () => void) => {
  // Сохраняем текущую позицию скролла и видимый элемент
  const scrollY = window.scrollY
  const elementInView = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
  const elementRect = elementInView?.getBoundingClientRect()
  const elementOffsetY = elementRect?.top || 0

  // Выполняем изменения DOM
  callback()

  // Восстанавливаем позицию скролла с учетом изменившейся высоты
  setTimeout(() => {
    if (elementInView) {
      // Пытаемся найти тот же элемент и скорректировать позицию
      const newRect = elementInView.getBoundingClientRect()
      const newOffsetY = newRect.top
      const offset = newOffsetY - elementOffsetY
      window.scrollTo(0, scrollY + offset)
    } else {
      // Если элемент не найден, восстанавливаем исходную позицию
      window.scrollTo(0, scrollY)
    }
  }, 0)
}

/**
 * Прокручивает страницу к комментарию с указанным ID
 * @param commentId - ID комментария для прокрутки
 * @param smooth - Использовать плавную прокрутку
 * @param delay - Задержка перед прокруткой в мс
 */
const scrollToComment = (commentId: number, smooth = true, delay = 300) => {
  if (!commentId) return

  // Используем setTimeout для гарантии, что DOM успел обновиться
  setTimeout(() => {
    // Пытаемся найти комментарий разными способами
    let commentElement = document.getElementById(`comment-${commentId}`)

    // Если не нашли по ID, ищем по атрибуту data-comment-id
    if (!commentElement) {
      commentElement = document.querySelector(`[data-comment-id="${commentId}"]`) as HTMLElement
    }

    // Если все еще не нашли, ищем внутри карточек комментариев
    if (!commentElement) {
      const cards = document.querySelectorAll(`.${styles.comment}`)
      for (const card of Array.from(cards)) {
        if (
          card.getAttribute('data-comment-id') === commentId.toString() ||
          card.getAttribute('id') === `comment-${commentId}`
        ) {
          commentElement = card as HTMLElement
          break
        }
      }
    }

    if (commentElement) {
      console.log('[CommentsTree] Scrolling to comment:', commentId)

      // Добавляем временный класс для подсветки комментария
      commentElement.classList.add(styles.isNew)

      // Прокручиваем к комментарию
      commentElement.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'center'
      })

      // Удаляем класс подсветки через некоторое время
      setTimeout(() => {
        commentElement?.classList.remove(styles.isNew)
      }, 3000)
    } else {
      console.warn('[CommentsTree] Comment element not found for scrolling:', commentId)
      // Если элемент не найден, дополнительная попытка через setTimeout
      setTimeout(() => {
        const retryElement =
          document.getElementById(`comment-${commentId}`) ||
          (document.querySelector(`[data-comment-id="${commentId}"]`) as HTMLElement)
        if (retryElement) {
          console.log('[CommentsTree] Scrolling to comment (retry):', commentId)
          retryElement.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto',
            block: 'center'
          })
          retryElement.classList.add(styles.isNew)
          setTimeout(() => {
            retryElement.classList.remove(styles.isNew)
          }, 3000)
        }
      }, 500) // Дополнительная задержка для повторной попытки
    }
  }, delay)
}

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

  // Состояния редактора
  const [editingCommentId, setEditingCommentId] = createSignal<number>()
  const [localContent, setLocalContent] = createSignal('')
  const [posting, setPosting] = createSignal(false)

  // Функция для проверки пустоты контента
  const isContentEmpty = (content: string) => {
    const div = document.createElement('div')
    div.innerHTML = content
    return !div.textContent?.trim()
  }

  // Обновляем мемоизированные значения для учета оптимистичных комментариев
  const comments = createMemo(() => {
    const allReactions = Object.values(reactionEntities())

    // Фильтруем и объединяем реальные и оптимистичные комментарии
    const filteredComments = allReactions.filter(
      (r) => r.kind === ReactionKind.Comment && r.shout?.slug === props.shoutSlug
    )

    console.log('[CommentsTree] Filtered comments count:', filteredComments.length)
    return filteredComments
  })

  const sortedComments = createMemo(() => {
    const currentComments = comments()
    if (!currentComments.length) return []

    if (onlyNew()) {
      return newComments().sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }

    return [...currentComments].sort((a, b) => {
      if (commentsOrder() === ReactionSort.Like) {
        return (b.stat?.rating || 0) - (a.stat?.rating || 0)
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  })

  const commentTree = createMemo(() => {
    const sorted = sortedComments()
    const tree: Record<number, Reaction[]> = {}

    // Используем Set для более эффективного отслеживания уже добавленных ID
    const addedCommentIds = new Set<number>()

    // Функция стабильного добавления комментариев к родителю
    const addToParent = (comment: Reaction) => {
      // Пропускаем комментарии без ID или с дубликатами ID
      if (!comment.id || addedCommentIds.has(comment.id)) {
        console.warn('[CommentsTree] Duplicate or invalid comment detected:', comment.id)
        return
      }

      const parentId = comment.reply_to || 0
      if (!tree[parentId]) {
        tree[parentId] = []
      }

      // Сохраняем существующий порядок для лучшей стабильности
      // Если комментарий уже существует по ID, обновляем его данные без изменения позиции
      const existingIndex = tree[parentId].findIndex((c) => c.id === comment.id)
      if (existingIndex >= 0) {
        // Обновляем существующий комментарий, сохраняя его позицию
        tree[parentId][existingIndex] = { ...comment }
      } else {
        // Добавляем новый комментарий в конец списка
        tree[parentId].push(comment)
      }

      // Регистрируем ID как добавленный
      addedCommentIds.add(comment.id)
    }

    // Сначала добавляем все комментарии к соответствующим родителям
    sorted.forEach(addToParent)

    // Дополнительное логирование для отладки
    console.log('[CommentsTree] Tree built, root comments:', tree[0]?.length || 0)

    return tree
  })

  // Загрузка комментариев
  const [commentsResource, { refetch: _refetch }] = createResource(
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

  createEffect(() => {
    if (isContentEmpty(localContent())) {
      untrack(() => setLocalContent(''))
    }
  })

  /**
   * Очистка состояния редактирования без сохранения
   */
  const handleCancelEdit = () => {
    const commentId = editingCommentId()
    if (!commentId) return

    // Находим комментарий, чтобы восстановить его исходное содержимое
    const commentToEdit = comments().find((c) => c.id === commentId)
    if (!commentToEdit) return

    // Дополнительная очистка черновика редактирования
    const draftKey = `draft-${props.shoutId}-comment-edit-${commentId}`
    setEditorContent(draftKey, '')

    // Сбрасываем состояние редактирования
    batch(() => {
      setEditingCommentId(undefined)
      setLocalContent('')
    })

    console.log('[CommentsTree] Edit cancelled for comment:', commentId)
  }

  /**
   * Обработчик для отправки комментария
   */
  const handleSubmitComment = async (parentId?: number) => {
    console.log('[CommentsTree] Starting comment submission:', {
      parentId,
      editingCommentId: editingCommentId(),
      content: localContent(),
      isContentEmpty: isContentEmpty(localContent())
    })

    if (!session()?.user) {
      showSnackbar({ type: 'error', body: t('Please sign in to comment') })
      return
    }

    // Очищаем контент от лишних переносов строк и преобразуем пустые параграфы
    const cleanedContent = cleanupContent(localContent().trim())

    if (isContentEmpty(cleanedContent)) {
      showSnackbar({ type: 'error', body: t('Comment cannot be empty') })
      return
    }

    setPosting(true)
    // Сохраняем позицию скролла только для редактирования
    const _scrollPosition = window.scrollY
    const _isEdit = editingCommentId() !== undefined

    try {
      // Финальная проверка и преобразование:
      // 1. Заменяем все пустые параграфы на параграфы с переносами
      // 2. Заменяем <br> на <p><br></p>
      // 3. Ограничиваем число последовательных переносов до двух
      const processedContent = cleanupContent(cleanedContent)

      // Очищаем с помощью sanitizeHtml и добавляем дополнительные проверки
      let sanitizedContent = String(sanitizeHtml(processedContent))

      // Дополнительная проверка на нежелательные последовательности
      sanitizedContent = sanitizedContent.replace(/(<p>\s*<\/p>){2,}/gi, '<p><br></p>')
      sanitizedContent = sanitizedContent.replace(/(<p><br\s*\/?><\/p>){3,}/gi, '<p><br></p><p><br></p>')

      // Проверяем, что в итоге содержимое не пустое
      if (isContentEmpty(sanitizedContent)) {
        showSnackbar({ type: 'error', body: t('Comment cannot be empty') })
        setPosting(false)
        return
      }

      console.log('[CommentsTree] Processed comment content:', {
        original: localContent().length,
        cleaned: cleanedContent.length,
        processed: processedContent.length,
        sanitized: sanitizedContent.length,
        content: sanitizedContent // Добавляем вывод содержимого для отладки
      })

      const commentId = editingCommentId()
      const isEditing = commentId !== undefined

      console.log('[CommentsTree] Processing edit:', { commentId, isEditing })

      const commentToEdit = isEditing ? comments().find((c) => c.id === commentId) : undefined
      if (isEditing && !commentToEdit) {
        console.error('[CommentsTree] Comment not found for editing:', commentId)
        showSnackbar({ type: 'error', body: t('Comment not found') })
        setPosting(false)
        return
      }

      // Очищаем форму и состояния до отправки запроса
      handleClear()

      // Отправляем запрос на сервер
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

      console.log('[CommentsTree] Sending request:', {
        operation: isEditing ? 'update' : 'create',
        commentId: isEditing ? commentId : undefined,
        replyTo: isEditing ? commentToEdit?.reply_to : parentId
      })

      const result = isEditing ? await updateShoutReaction(input) : await createShoutReaction(input)

      console.log('[CommentsTree] Got response:', result)

      // Если результат - объект но не содержит id, это может указывать на проблему
      if (result && typeof result === 'object' && !('error' in result) && !('id' in result)) {
        console.warn('[CommentsTree] Странный формат ответа от сервера:', result)
      }

      // Проверяем на ошибку cannot update reaction
      if (result && 'error' in result) {
        console.error('[CommentsTree] Error in response:', result.error)

        // Специфическая обработка ошибки "cannot update reaction"
        if (result.error === 'cannot update reaction') {
          try {
            showSnackbar({
              type: 'error',
              body: t('Could not update or publish comment')
            })
          } catch (error) {
            console.error('[CommentsTree] Ошибка при публикации комментария:', error)
            showSnackbar({
              type: 'error',
              body: t('Failed to publish comment')
            })
          }
        }
        // Обработка других ошибок
        showSnackbar({ type: 'error', body: t('Failed to save comment') })

        setPosting(false)
        return
      }

      // Только при успешном ответе обрабатываем результат
      if (result && !('error' in result)) {
        const serverData = result as Reaction

        if (isEditing) {
          // Для редактирования обновляем только существующий комментарий
          console.log('[CommentsTree] Comment updated successfully')

          // Добавляем обновленный комментарий в хранилище реакций
          addShoutReactions([serverData])

          showSnackbar({ type: 'success', body: t('Comment updated') })
        } else {
          // Для новых комментариев добавляем результат с сервера
          console.log('[CommentsTree] Comment created successfully')

          // Добавляем новый комментарий в хранилище реакций
          addShoutReactions([serverData])

          showSnackbar({ type: 'success', body: t('Comment saved') })

          // Прокручиваем к новому комментарию с небольшой задержкой для обновления DOM
          scrollToComment(serverData.id, true, 300)
        }
      }
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

    // Более безопасная и контролируемая очистка редактора
    try {
      // Находим конкретный редактор по его ID вместо общего селектора
      const editor = document.querySelector(`[data-editor-id="${draftKey}"]`)
      if (editor) {
        editor.innerHTML = ''
        // Вызываем событие input для обновления состояния
        editor.dispatchEvent(new Event('input', { bubbles: true }))
      }
    } catch (error) {
      console.warn('[CommentsTree] Error clearing editor:', error)
    }

    // Сбрасываем состояния атомарно, чтобы избежать лишних ререндеров
    batch(() => {
      setEditingCommentId(undefined)
      setClickedReplyId(undefined)
      setLocalContent('')
    })

    console.log('[CommentsTree] Editor state cleared')
  }

  const handleReply = (replyToCommentId: number) => {
    if (!replyToCommentId) return
    if (!session()?.user) {
      showSnackbar({ type: 'error', body: t('Please sign in to reply') })
      return
    }

    // Сначала очищаем все состояния, затем устанавливаем новое
    batch(() => {
      // Очищаем все предыдущие состояния
      setLocalContent('')
      setEditingCommentId(undefined)

      // Устанавливаем новое состояние после очистки
      setClickedReplyId(replyToCommentId)
      setEditorContent(`draft-${props.shoutId}-comment-reply-${replyToCommentId}`, '')
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
      // Очищаем все предыдущие состояния
      setClickedReplyId(undefined)
      setLocalContent('')

      // Устанавливаем новое состояние после очистки
      setEditingCommentId(commentId)
      const content = commentToEdit.body || ''
      setLocalContent(content)
      setEditorContent(`draft-${props.shoutId}-comment-edit-${commentId}`, content)
    })
  }

  /**
   * Обработчик для удаления комментария
   */
  const handleDelete = async (id: number) => {
    if (!id) return
    if (!session()?.user) {
      showSnackbar({ type: 'error', body: t('Please sign in to delete') })
      return
    }

    try {
      // Запоминаем удаляемый комментарий для возможного восстановления
      const commentToDelete = comments().find((c) => c.id === id)
      if (!commentToDelete) {
        console.error('[CommentsTree] Comment not found for deletion:', id)
        return
      }

      // Проверяем, был ли комментарий сохранен на сервере
      // Временные комментарии могут иметь отрицательные или очень большие ID (больше 1000000000)
      const isLocalComment = id < 0 || id > 1000000000

      if (isLocalComment) {
        console.log('[CommentsTree] Canceling local comment deletion:', id)
        // Это временный комментарий, который еще не добавлен на сервер
        // Просто восстанавливаем его в локальном хранилище после анимации удаления
        setTimeout(() => {
          if (commentToDelete) {
            console.log('[CommentsTree] Restoring local comment:', id)
            addShoutReactions([commentToDelete])
            showSnackbar({ type: 'success', body: t('Comment restored') })
          }
        }, 500) // Ждем завершения анимации удаления
        return
      }

      // Оптимистично удаляем комментарий из UI, сохраняя позицию скролла
      withPreservedScroll(() => {
        // Копируем текущее состояние хранилища
        const currentReactions = reactionEntities()
        const updatedReactions: Record<string, Reaction> = { ...currentReactions }

        // Удаляем комментарий и его дочерние элементы из копии
        const removeComment = (commentId: number) => {
          delete updatedReactions[commentId.toString()]

          // Находим дочерние комментарии для этого комментария
          Object.values(updatedReactions).forEach((reaction) => {
            if (reaction.reply_to === commentId) {
              removeComment(reaction.id)
            }
          })
        }

        // Выполняем рекурсивное удаление
        removeComment(id)

        // Применяем изменения без ререндера всего дерева
        if (Object.keys(currentReactions).length !== Object.keys(updatedReactions).length) {
          untrack(() => {
            if (typeof addShoutReactions === 'function') {
              Object.values(updatedReactions).forEach((r) => {
                addShoutReactions([r])
              })
            }
          })
        }
      })

      // Отправляем запрос на сервер без отображения сообщения об успехе заранее
      const result = await deleteShoutReaction(id)

      if (result?.error) {
        console.error('[CommentsTree] Error in delete response:', result.error)
        showSnackbar({ type: 'error', body: t('Failed to delete comment') })

        // Если удаление на сервере не удалось, восстанавливаем комментарий
        if (commentToDelete) {
          console.log('[CommentsTree] Restoring comment after failed deletion:', id)
          setTimeout(() => {
            addShoutReactions([commentToDelete])
          }, 100)
        }
        return
      }

      // Показываем сообщение об успехе ТОЛЬКО после подтверждения с сервера
      showSnackbar({ type: 'success', body: t('Comment deleted') })

      // Обновляем колбэк только при успешном удалении на сервере
      if (props.onDeleteComment) {
        props.onDeleteComment(id)
      }
    } catch (error) {
      console.error('[CommentsTree] Error deleting comment:', error)
      showSnackbar({ type: 'error', body: t('Failed to delete comment') })

      // Пытаемся восстановить комментарий при ошибке
      const commentToRestore = comments().find((c) => c.id === id)
      if (commentToRestore) {
        setTimeout(() => {
          addShoutReactions([commentToRestore])
        }, 100)
      }
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

  // Компонент для кнопок управления редактором, используется во всех режимах
  const EditorControls = (props: {
    mode: 'new' | 'edit' | 'reply'
    onSave: () => void
    onCancel: () => void
    isDisabled: boolean
  }) => {
    return (
      <div
        class={clsx(styles.editingButtonsWrapper, {
          [styles.hidden]: props.isDisabled
        })}
      >
        <Button variant="secondary" value={t('Cancel')} onClick={props.onCancel} />
        <Button
          value={t(posting() ? 'Saving...' : 'Save')}
          variant="primary"
          onClick={props.onSave}
          disabled={posting()}
        />
      </div>
    )
  }

  /**
   * Обработчик изменения содержимого редактора для существующего комментария
   */
  const handleExistingChange = (data: EditorData, commentId: number) => {
    setEditingCommentId(commentId)
    console.log('[CommentsTree] Edit editor onChange:', {
      commentId: commentId,
      content: data.content,
      isEmpty: data.isEmpty,
      plainText: data.plainText || data.content.replace(/<[^>]*>/g, '')
    })

    // Если контент пустой, очищаем его полностью
    if (isContentEmpty(data.content)) {
      setLocalContent('')
      return
    }

    // Проверяем на пустые параграфы или избыточные переносы
    const hasEmptyParagraphs = /<p>\s*<\/p>/gi.test(data.content)
    const hasExcessiveBreaks = /(<p><br\s*\/?><\/p>){3,}/gi.test(data.content)

    // Обрабатываем контент если нужно
    if (hasEmptyParagraphs || hasExcessiveBreaks) {
      // Применяем нормализацию
      const cleanedContent = cleanupContent(data.content)

      // Обновляем редактор напрямую только если у него есть фокус
      const activeEditor = document.activeElement as HTMLElement
      if (activeEditor?.getAttribute('data-editor-id')) {
        // Сохраняем позицию курсора
        let savedSelection: Range | null = null
        try {
          if (window.getSelection) {
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
              savedSelection = selection.getRangeAt(0).cloneRange()
            }
          }
        } catch (e) {
          console.warn('[CommentsTree] Could not save cursor position:', e)
        }

        // Используем setTimeout для обновления вне текущего цикла событий
        setTimeout(() => {
          try {
            activeEditor.innerHTML = cleanedContent

            // Восстанавливаем курсор
            if (savedSelection) {
              const selection = window.getSelection()
              if (selection) {
                selection.removeAllRanges()
                selection.addRange(savedSelection)
              }
            }
          } catch (err) {
            console.warn('[CommentsTree] Could not update editor content:', err)
          }
        }, 0)
      }

      setLocalContent(cleanedContent)
    } else {
      // Сохраняем без изменений
      setLocalContent(data.content)
    }

    // Сохраняем в черновик
    untrack(() => setEditorContent(`draft-${props.shoutId}-comment-edit-${commentId}`, localContent()))
  }

  /**
   * Обработчик потери фокуса редактором
   * Нормализует контент, заменяя пустые параграфы
   */
  const handleEditorBlur = (draftKey: string) => {
    const content = getEditorContent(draftKey)
    if (!content) return

    // Находим текущий редактор
    const editor = document.querySelector(`[data-editor-id="${draftKey}"]`) as HTMLElement
    if (!editor) return

    // Проверяем на полностью пустой контент
    if (isContentEmpty(content)) {
      batch(() => {
        setLocalContent('')
        setEditorContent(draftKey, '')
        // Очищаем редактор напрямую
        if (editor) {
          editor.innerHTML = ''
        }
      })
      return
    }

    // Проверяем на пустые параграфы или избыточные переносы
    const hasEmptyParagraphs = /<p>\s*<\/p>/gi.test(content)
    const hasExcessiveBreaks = /(<p><br\s*\/?><\/p>){3,}/gi.test(content)

    // Обрабатываем контент если нужна нормализация
    if (hasEmptyParagraphs || hasExcessiveBreaks) {
      // Применяем стандартную очистку
      const cleanedContent = cleanupContent(content)

      // Сохраняем и применяем изменения
      setLocalContent(cleanedContent)
      setEditorContent(draftKey, cleanedContent)

      // Синхронизируем с DOM
      if (editor) {
        editor.innerHTML = cleanedContent
      }
    } else {
      // Просто сохраняем текущее содержимое
      setLocalContent(content)
    }
  }

  /**
   * Компонент ветки комментариев
   * Отображает дочерние комментарии и форму ответа
   */
  const CommentBranch = (props: { parentId: number; shoutId: number; articleAuthors?: Author[] }) => {
    console.log('[CommentBranch] Rendering branch:', {
      parentId: props.parentId,
      shoutId: props.shoutId
    })

    const { t } = useLocalize()

    // Используем createMemo с стабильными ключами для оптимизации обновлений
    const children = createMemo(() => {
      const branch = commentTree()[props.parentId] || []
      return branch
    })

    return (
      <>
        {/* Показываем форму ответа отдельно, вне зависимости от наличия дочерних комментариев */}
        <Show when={clickedReplyId() === props.parentId}>
          <ul class={clsx(styles.commentsList)}>
            <li class={styles.replyEditor}>
              <SimpleRichEditor
                editorId={`draft-${props.shoutId}-comment-${clickedReplyId()}`}
                commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                placeholder={t('Write a reply...')}
                onChange={handleReplyEditorChange}
                onBlur={() => handleEditorBlur(`draft-${props.shoutId}-comment-${clickedReplyId()}`)}
                content={getEditorContent(`draft-${props.shoutId}-comment-${clickedReplyId()}`)}
                toolbar="bottom"
              />
              <EditorControls
                mode="reply"
                onSave={() => handleSubmitComment(clickedReplyId() as number)}
                onCancel={() => handleClear()}
                isDisabled={isContentEmpty(localContent())}
              />
            </li>
          </ul>
        </Show>

        {/* Показываем дочерние комментарии отдельно */}
        <Show when={children().length > 0}>
          <ul class={clsx(styles.commentsList)}>
            {/* Используем стабильный ключ для идентификации комментариев */}
            <For each={children()} fallback={<div>{t('No replies yet')}</div>}>
              {(comment) => (
                <li class={styles.commentItem} data-comment-id={comment.id}>
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
                    onEditorChange={(data) => handleExistingChange(data, comment.id)}
                    onCancelEdit={handleCancelEdit}
                    onSaveEdit={() => handleSubmitComment(undefined)}
                    onCancelReply={handleClear}
                    onSaveReply={() => handleSubmitComment(clickedReplyId() as number)}
                    content={
                      editingCommentId() === comment.id
                        ? getEditorContent(`draft-${props.shoutId}-comment-edit-${comment.id}`)
                        : undefined
                    }
                  >
                    <CommentBranch
                      parentId={comment.id}
                      shoutId={props.shoutId}
                      articleAuthors={props.articleAuthors}
                    />
                  </CommentCard>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </>
    )
  }

  const handleEditorChange = (data: EditorData) => {
    console.log('[CommentsTree] Editor onChange:', {
      content: data.content,
      isEmpty: data.isEmpty,
      plainText: data.plainText || data.content.replace(/<[^>]*>/g, '')
    })

    // Если контент пустой, очищаем его полностью
    if (isContentEmpty(data.content)) {
      setLocalContent('')
      return
    }

    // Проверяем на пустые параграфы или избыточные переносы
    const hasEmptyParagraphs = /<p>\s*<\/p>/gi.test(data.content)
    const hasExcessiveBreaks = /(<p><br\s*\/?><\/p>){3,}/gi.test(data.content)

    // Обрабатываем контент если есть пустые параграфы или избыточные переносы
    if (hasEmptyParagraphs || hasExcessiveBreaks) {
      // Применяем нормализацию
      const cleanedContent = cleanupContent(data.content)
      setLocalContent(cleanedContent)
    } else {
      // Иначе сохраняем без изменений
      setLocalContent(data.content)
    }

    // Сохраняем в черновик
    untrack(() => setEditorContent(`draft-${props.shoutId}-comment-new`, localContent()))
  }

  /**
   * Обработчик изменений в форме ответа на комментарий
   */
  const handleReplyEditorChange = (data: EditorData) => {
    console.log('[CommentsTree] Reply editor onChange:', {
      replyTo: clickedReplyId(),
      content: data.content,
      isEmpty: data.isEmpty
    })

    // Если контент пустой, очищаем его полностью
    if (isContentEmpty(data.content)) {
      setLocalContent('')
      return
    }

    // Проверяем на пустые параграфы или избыточные переносы
    const hasEmptyParagraphs = /<p>\s*<\/p>/gi.test(data.content)
    const hasExcessiveBreaks = /(<p><br\s*\/?><\/p>){3,}/gi.test(data.content)

    // Если есть - сразу нормализуем
    if (hasEmptyParagraphs || hasExcessiveBreaks) {
      const cleanedContent = cleanupContent(data.content)
      setLocalContent(cleanedContent)
    } else {
      // Просто сохраняем контент
      setLocalContent(data.content)
    }

    // Сохраняем в черновик
    untrack(() => setEditorContent(`draft-${props.shoutId}-comment-${clickedReplyId()}`, localContent()))
  }

  return (
    <ErrorBoundary fallback={(err) => <div>Error: {err.toString()}</div>}>
      <div>
        <Show when={!isLoading()} fallback={<Loading />}>
          {/* Показываем основной редактор только если не редактируем комментарий и не отвечаем на комментарий */}
          <Show when={!clickedReplyId() && !editingCommentId()}>
            <ShowIfAuthenticated fallback={<FallbackMessage />}>
              <div>
                <SimpleRichEditor
                  toolbar="bottom"
                  editorId={`draft-${props.shoutId}-comment-new`}
                  commands={['bold', 'italic', 'link', 'blockquote', 'image']}
                  placeholder={t('Write a comment...')}
                  onChange={handleEditorChange}
                  onBlur={() => handleEditorBlur(`draft-${props.shoutId}-comment-new`)}
                  content={getEditorContent(`draft-${props.shoutId}-comment-new`)}
                />
                <EditorControls
                  mode="new"
                  onSave={() => handleSubmitComment(undefined)}
                  onCancel={() => handleClear()}
                  isDisabled={isContentEmpty(localContent())}
                />
              </div>
            </ShowIfAuthenticated>
          </Show>

          <CommentsHeader
            comments={comments()}
            newComments={newComments()}
            order={commentsOrder()}
            setOrder={setCommentsOrder}
            onlyNew={onlyNew()}
            toggleNewOnly={toggleNewOnly}
          />

          <Show when={comments().length > 0}>
            <ul class={clsx(styles.commentsList)}>
              <For
                each={commentTree()[0] || []}
                // В SolidJS ключ указываем здесь для оптимизации рендера
                fallback={<div class={styles.noComments}>{t('No comments yet')}</div>}
              >
                {(comment) => (
                  // Используем id комментария как часть идентификатора для элементов списка
                  <li class={styles.commentItem} data-comment-id={comment.id}>
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
                      onEditorChange={(data) => handleExistingChange(data, comment.id)}
                      onCancelEdit={handleCancelEdit}
                      onSaveEdit={() => handleSubmitComment(undefined)}
                      onCancelReply={handleClear}
                      onSaveReply={() => handleSubmitComment(clickedReplyId() as number)}
                      content={
                        editingCommentId() === comment.id
                          ? getEditorContent(`draft-${props.shoutId}-comment-edit-${comment.id}`)
                          : undefined
                      }
                    >
                      <CommentBranch
                        parentId={comment.id}
                        shoutId={props.shoutId}
                        articleAuthors={props.articleAuthors}
                      />
                    </CommentCard>
                  </li>
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
        </Show>
      </div>
    </ErrorBoundary>
  )
}
