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
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
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
   * Очищает текст от лишних переносов строк и пустых тегов
   * @param content HTML содержимое
   * @returns Очищенный HTML
   */
  const cleanupContent = (content: string): string => {
    if (!content.trim()) return ''

    const div = document.createElement('div')
    div.innerHTML = content

    // Удаляем пустые теги
    const removeEmptyTags = (element: Element) => {
      const children = Array.from(element.children)
      children.forEach((child) => {
        removeEmptyTags(child)
        const hasText = child.textContent?.trim()
        const hasNonEmptyChildren = Array.from(child.children).some(
          (el) => el.textContent?.trim() || el.nodeName.toLowerCase() === 'img'
        )
        if (!hasText && !hasNonEmptyChildren) {
          child.remove()
        }
      })
    }

    // Заменяем множественные последовательные пустые параграфы и <br> на один <br>
    const normalizeConsecutiveBreaks = (element: Element) => {
      let html = element.innerHTML

      // Заменяем множественные <br> (или параграфы с <br>) на один <br>
      html = html.replace(/(<p><br><\/p>|<br>){3,}/gi, '<br><br>')

      // Ограничиваем максимум до двух переносов строк подряд
      html = html.replace(/(<p>\s*<\/p>){3,}/gi, '<p></p><p></p>')

      element.innerHTML = html
    }

    // Удаляем лишние переносы в конце
    const removeTrailingBreaks = (element: Element) => {
      let html = element.innerHTML
      html = html.replace(/(<p><br><\/p>|<p><\/p>|<p>\s*<\/p>|<br>)+$/gi, '')
      html = html.replace(/(<br>|<br\s*\/?>)\s*$/gi, '')
      html = html.replace(/\s+$/g, '')

      if (!html.trim()) {
        html = '<p><br></p>'
      }

      element.innerHTML = html
    }

    removeEmptyTags(div)
    normalizeConsecutiveBreaks(div)
    removeTrailingBreaks(div)

    console.log('[CommentsTree] Cleaned content:', div.innerHTML)
    return div.innerHTML
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

    // Очищаем контент от лишних переносов строк и пустых тегов
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
      const sanitizedContent = String(sanitizeHtml(cleanedContent))
      const commentId = editingCommentId()
      const isEditing = commentId !== undefined

      console.log('[CommentsTree] Processing edit:', {
        commentId,
        isEditing,
        sanitizedContent
      })

      const commentToEdit = isEditing ? comments().find((c) => c.id === commentId) : undefined
      if (isEditing && !commentToEdit) {
        console.error('[CommentsTree] Comment not found for editing:', commentId)
        showSnackbar({ type: 'error', body: t('Comment not found') })
        setPosting(false)
        return
      }

      // Очищаем форму и состояния до отправки запроса, чтобы избежать промежуточных состояний
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
        input,
        isEditing
      })

      const result = isEditing ? await updateShoutReaction(input) : await createShoutReaction(input)

      console.log('[CommentsTree] Got response:', result)

      if (result && 'error' in result && result.error) {
        console.error('[CommentsTree] Error in response:', result.error)
        showSnackbar({ type: 'error', body: result.error })
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

      // Оптимистично удаляем комментарий, сохраняя позицию скролла
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
        // Используем внутренний метод контекста реакций для атомарного обновления
        if (Object.keys(currentReactions).length !== Object.keys(updatedReactions).length) {
          // Обновляем состояние без refetch
          // Это не вызовет полного перестроения дерева
          untrack(() => {
            // @ts-ignore - доступ к внутреннему методу контекста
            // Если нет прямого доступа, можно использовать другие механизмы состояния
            if (typeof addShoutReactions === 'function') {
              // Обновляем только локальное состояние
              // Применяем изменения к хранилищу реакций
              Object.values(updatedReactions).forEach((r) => {
                addShoutReactions([r])
              })
            }
          })
        }
      })

      // Сообщаем об удалении UI до запроса на сервер
      showSnackbar({ type: 'success', body: t('Comment deleted') })

      // Затем выполняем запрос на сервер
      const result = await deleteShoutReaction(id)
      if (result?.error) {
        console.error('[CommentsTree] Error in delete response:', result.error)
        showSnackbar({ type: 'error', body: t('Failed to delete comment') })

        // Если удаление на сервере не удалось, восстанавливаем комментарий
        if (commentToDelete) {
          addShoutReactions([commentToDelete])
        }
        return
      }

      // Обновляем колбэк только при успешном удалении на сервере
      if (props.onDeleteComment) {
        props.onDeleteComment(id)
      }

      // Не делаем полный refetch после успешного удаления
      // await refetch()
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
   * Компонент ветки комментариев
   * Отображает дочерние комментарии и форму ответа
   */
  const CommentBranch = (props: { parentId: number; shoutId: number; articleAuthors?: Author[] }) => {
    console.log('[CommentBranch] Rendering branch:', {
      parentId: props.parentId,
      shoutId: props.shoutId
    })

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
                    onEdit={() => handleEdit(comment.id)}
                    clickedReplyId={clickedReplyId}
                    articleAuthors={props.articleAuthors}
                    myRate={getCommentRate(comment.id)}
                    onEditorChange={(data) => handleExistingChange(data, comment.id)}
                    onCancelEdit={() => {
                      handleCancelEdit()
                    }}
                    onSaveEdit={() => {
                      handleSubmitComment(undefined)
                    }}
                    onCancelReply={() => {
                      handleClear()
                    }}
                    onSaveReply={() => {
                      handleSubmitComment(clickedReplyId() as number)
                    }}
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

  const handleEditorBlur = (draftKey: string) => {
    const content = getEditorContent(draftKey)
    if (content) {
      // Находим текущий редактор
      const editor = document.querySelector(`[data-editor-id="${draftKey}"]`) as HTMLElement
      if (!editor) return

      // Сохраняем текущую позицию курсора и выделение
      let savedSelection: Range | null = null
      if (window.getSelection) {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          savedSelection = selection.getRangeAt(0).cloneRange()
        }
      }

      // Очищаем содержимое от лишних тегов и переносов строк
      const cleanedContent = cleanupContent(content)

      // Если после очистки контент пустой - очищаем редактор полностью
      if (isContentEmpty(cleanedContent)) {
        batch(() => {
          setLocalContent('')
          setEditorContent(draftKey, '')

          // Очищаем содержимое редактора напрямую
          if (editor) {
            editor.innerHTML = ''
          }
        })
      } else {
        // Иначе обновляем содержимое с очищенными переносами строк
        setLocalContent(cleanedContent)
        setEditorContent(draftKey, cleanedContent)

        // Обновляем содержимое редактора напрямую для синхронизации
        if (editor) {
          // Важно: запоминаем, что редактор в фокусе для восстановления курсора
          const editorHasFocus = document.activeElement === editor
          editor.innerHTML = cleanedContent

          // Восстанавливаем позицию курсора, если элемент был в фокусе и у нас есть сохраненная позиция
          if (editorHasFocus && savedSelection) {
            try {
              const selection = window.getSelection()
              if (selection) {
                selection.removeAllRanges()
                selection.addRange(savedSelection)
              }
            } catch (e) {
              console.warn('[CommentsTree] Could not restore cursor position:', e)
            }
          }
        }
      }
    }
  }

  const handleExistingChange = (data: EditorData, commentId: number) => {
    setEditingCommentId(commentId)
    console.log('[CommentsTree] Edit editor onChange:', {
      commentId: commentId,
      content: data.content,
      isEmpty: data.isEmpty,
      plainText: data.plainText
    })

    // Проверяем, есть ли последовательные переносы строк
    let content = data.content
    const hasConsecutiveBreaks =
      /(<p><br><\/p>|<br>){3,}/gi.test(content) || /(<p>\s*<\/p>){3,}/gi.test(content)

    // Если есть - сразу нормализуем без ожидания потери фокуса
    if (hasConsecutiveBreaks) {
      content = cleanupContent(content)

      // Обновляем редактор напрямую, чтобы не было визуального дребезжания
      const activeEditor = document.activeElement as HTMLElement
      if (activeEditor?.getAttribute('data-editor-id')) {
        // Позиция курсора будет восстановлена в setTimeout
        setTimeout(() => {
          activeEditor.innerHTML = content
        }, 0)
      }
    }

    setLocalContent(content)
    untrack(() => setEditorContent(`draft-${props.shoutId}-comment-edit-${commentId}`, content))
  }

  const handleEditorChange = (data: EditorData) => {
    console.log('[CommentsTree] New comment editor onChange:', {
      content: data.content,
      isEmpty: data.isEmpty
    })

    // Проверяем, есть ли последовательные переносы строк
    let content = data.content
    const hasConsecutiveBreaks =
      /(<p><br><\/p>|<br>){3,}/gi.test(content) || /(<p>\s*<\/p>){3,}/gi.test(content)

    // Если есть - сразу нормализуем без ожидания потери фокуса
    if (hasConsecutiveBreaks) {
      content = cleanupContent(content)

      // Обновляем редактор напрямую, чтобы не было визуального дребезжания
      const activeEditor = document.activeElement as HTMLElement
      if (activeEditor?.getAttribute('data-editor-id')) {
        // Запоминаем позицию курсора
        let savedSelection: Range | null = null
        if (window.getSelection) {
          const selection = window.getSelection()
          if (selection && selection.rangeCount > 0) {
            savedSelection = selection.getRangeAt(0).cloneRange()
          }
        }

        // Используем setTimeout, чтобы не мешать текущему циклу обработки ввода
        setTimeout(() => {
          activeEditor.innerHTML = content

          // Восстанавливаем курсор
          if (savedSelection) {
            try {
              const selection = window.getSelection()
              if (selection) {
                selection.removeAllRanges()
                selection.addRange(savedSelection)
              }
            } catch (e) {
              console.warn('[CommentsTree] Could not restore cursor position:', e)
            }
          }
        }, 0)
      }
    }

    setLocalContent(content)
    untrack(() => setEditorContent(`draft-${props.shoutId}-comment-new`, content))
  }

  return (
    <ErrorBoundary fallback={(err) => <div>Error: {err.toString()}</div>}>
      <div>
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
                      onEditorChange={(data) => {
                        console.log('[CommentsTree] Edit editor onChange:', {
                          commentId: comment.id,
                          content: data.content,
                          isEmpty: data.isEmpty,
                          plainText: data.plainText
                        })

                        // Проверяем, есть ли последовательные переносы строк
                        let content = data.content
                        const hasConsecutiveBreaks =
                          /(<p><br><\/p>|<br>){3,}/gi.test(content) || /(<p>\s*<\/p>){3,}/gi.test(content)

                        // Если есть - сразу нормализуем без ожидания потери фокуса
                        if (hasConsecutiveBreaks) {
                          content = cleanupContent(content)

                          // Обновляем редактор напрямую, чтобы не было визуального дребезжания
                          const activeEditor = document.activeElement as HTMLElement
                          if (activeEditor?.getAttribute('data-editor-id')) {
                            // Позиция курсора будет восстановлена в setTimeout
                            setTimeout(() => {
                              activeEditor.innerHTML = content
                            }, 0)
                          }
                        }

                        setLocalContent(content)
                        untrack(() =>
                          setEditorContent(`draft-${props.shoutId}-comment-edit-${comment.id}`, content)
                        )
                      }}
                      onCancelEdit={() => {
                        handleCancelEdit()
                      }}
                      onSaveEdit={() => {
                        handleSubmitComment(undefined)
                      }}
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
        </Show>
      </div>
    </ErrorBoundary>
  )
}
