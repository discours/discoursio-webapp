import clsx from 'clsx'
import {
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  ErrorBoundary,
  For,
  onMount,
  Show,
  untrack
} from 'solid-js'
import toast from 'solid-toast'
import { COMMENTS_PER_PAGE } from '~/constants/pagination'
import { useDrafts } from '~/context/drafts'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { useCommentsMyRates } from '~/graphql/api/private'
import {
  Author,
  MutationCreate_ReactionArgs,
  MutationUpdate_ReactionArgs,
  Reaction,
  ReactionKind,
  ReactionSort
} from '~/graphql/generated/graphql'
import { Button } from '../_shared/Button'
import { Loading } from '../_shared/Loading'
import { LoadMoreItems, LoadMoreWrapper } from '../_shared/LoadMoreWrapper'
import { ShowIfAuthenticated } from '../_shared/ShowIfAuthenticated'
import { cleanupContent, sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { EditorData } from '../SimpleRichEditor/lib/types'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
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
 * @property {number} totalComments - Общее количество комментариев в статье
 * @property {function} [onDeleteComment] - Callback при удалении комментария
 */
interface CommentsTreeProps {
  articleAuthors: Author[]
  shoutSlug: string
  shoutId: number
  totalComments: number
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
  const { getEditorContent, setEditorContent, removeDraftByKey } = useDrafts()
  const [onlyNew, setOnlyNew] = createSignal(false)
  const [clickedReplyId, setClickedReplyId] = createSignal<number | undefined>()
  const {
    reactionEntities,
    createShoutReaction,
    updateShoutReaction,
    addShoutReactions,
    deleteShoutReaction,
    loadCommentsBranch
  } = useReactions()
  const [newComments, setNewComments] = createSignal<Reaction[]>([])
  const [commentsOrder, setCommentsOrder] = createSignal<'newest' | 'oldest' | 'popular'>('newest')
  const [isLoading, setIsLoading] = createSignal(true)

  // Состояния редактора
  const [editingCommentId, setEditingCommentId] = createSignal<number | undefined>()
  const [localContent, setLocalContent] = createSignal<string>('')
  const [posting, setPosting] = createSignal(false)

  // Состояния для сохранения контента между переключениями режимов
  const [mainEditorContent, setMainEditorContent] = createSignal<string>('')
  const [replyEditorContents, setReplyEditorContents] = createSignal<Record<string, string>>({})

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

  // Мемо для сортировки комментариев по выбранному порядку
  const sortedComments = createMemo(() => {
    const sortOrder = commentsOrder()
    const allComments = comments()

    // Фильтрация "только новые" если активирован этот режим
    let filteredComments = allComments
    if (onlyNew() && newComments().length > 0) {
      filteredComments = newComments()
      console.log('[CommentsTree] Только новые комментарии:', filteredComments.length)
    }

    console.log('[CommentsTree] Sorting comments:', filteredComments.length, 'order:', sortOrder)

    if (sortOrder === 'newest') {
      return [...filteredComments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    if (sortOrder === 'oldest') {
      return [...filteredComments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }

    if (sortOrder === 'popular') {
      return [...filteredComments].sort((a, b) => {
        const aRate = a.stat?.rating ?? 0
        const bRate = b.stat?.rating ?? 0
        return bRate - aRate || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }

    return filteredComments
  })

  const commentTree = createMemo(() => {
    const sorted = sortedComments()
    const tree: Record<number, Reaction[]> = {}

    // Используем Set для более эффективного отслеживания уже добавленных ID
    const addedCommentIds = new Set<number>()

    // Функция стабильного добавления комментариев к родителю
    const addToParent = (comment: Reaction) => {
      if (!comment) {
        console.warn('[CommentsTree] Attempted to add undefined comment to tree')
        return
      }

      // Проверяем валидность комментария и его ID
      if (!comment.id) {
        console.warn('[CommentsTree] Comment without ID detected:', comment)
        return
      }

      if (addedCommentIds.has(comment.id)) {
        // Такой комментарий уже добавлен в дерево
        console.debug('[CommentsTree] Duplicate comment detected:', comment.id)
        return
      }

      const parentId = comment.reply_to || 0

      // Инициализируем массив для родителя, если его еще нет
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

    // Добавляем сначала все комментарии первого уровня (корневые)
    sorted.filter((c) => !c.reply_to).forEach(addToParent)

    // Затем добавляем все вложенные комментарии
    sorted.filter((c) => c.reply_to).forEach(addToParent)

    // Подробное логирование для отладки
    const rootCommentIds = (tree[0] || []).map((c) => c.id).join(', ')
    const totalInTree = Object.values(tree).reduce((sum, arr) => sum + arr.length, 0)

    console.log(`[CommentsTree] Tree built: total ${totalInTree} comments, ${tree[0]?.length || 0} root comments`)
    console.log(`[CommentsTree] Root comment IDs: ${rootCommentIds}`)

    return tree
  })

  // Загрузка комментариев при инициализации
  const [commentsResource, { refetch: _refetch }] = createResource(
    () => props.shoutId,
    async (shout) => {
      setIsLoading(true)
      try {
        // Вычисляем адаптивный лимит загрузки дочерних комментариев
        const childrenLimit = props.totalComments < 30 ? null : 3

        console.log(`[CommentsTree] Loading initial comments for shout ${shout} with children_limit:`, childrenLimit)

        // Вместо старого метода используем новый API для загрузки с ветками
        const response = await loadCommentsBranch({
          shout,
          parent_id: null, // Загружаем корневые комментарии
          limit: COMMENTS_PER_PAGE,
          offset: 0,
          sort:
            commentsOrder() === 'newest'
              ? ReactionSort.Newest
              : commentsOrder() === 'oldest'
                ? ReactionSort.Oldest
                : ReactionSort.Like,
          children_limit: childrenLimit // Адаптивный лимит ответов
        })

        if (response?.length) {
          console.log(
            `[CommentsTree] Initial load: ${response.length} root comments, total expected: ${props.totalComments}`
          )

          untrack(() => {
            // Перед добавлением новых комментариев, проверяем текущее состояние
            const beforeCount = Object.keys(reactionEntities()).length

            // Явно добавляем все полученные комментарии в хранилище
            addShoutReactions(response)

            // Проверяем, сколько комментариев добавилось
            const afterCount = Object.keys(reactionEntities()).length
            const addedCount = afterCount - beforeCount

            console.log(`[CommentsTree] Added ${addedCount} comments to store (${beforeCount} -> ${afterCount})`)

            // Проверяем полноту загрузки
            const totalLoaded = response.length
            const shouldHideLoadMore = totalLoaded >= props.totalComments || totalLoaded < COMMENTS_PER_PAGE

            console.log(
              `[CommentsTree] Should hide "Load More"? ${shouldHideLoadMore} (loaded: ${totalLoaded}, total: ${props.totalComments})`
            )
            setLoadMoreHidden(shouldHideLoadMore)

            // Принудительно форсируем пересчет дерева комментариев
            setTimeout(() => {
              const rootCommentsCount = commentTree()[0]?.length || 0
              console.log(`[CommentsTree] After initial load: ${rootCommentsCount} root comments in tree`)
            }, 0)
          })
        } else {
          console.log('[CommentsTree] No comments loaded on initial request')
          untrack(() => setLoadMoreHidden(true))
        }

        return response || []
      } catch (error) {
        console.error('[CommentsTree] Error loading comments:', error)
        toast.error(t('Failed to load comments'))
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

    // Удаляем локальную версию и черновик с помощью removeDraftByKey
    removeDraftByKey(draftKey)
    setEditorContent(draftKey, '') // Очищаем и в контексте

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

    if (!session()?.author) {
      toast.error(t('Please sign in to comment'))
      return
    }

    // Очищаем контент от лишних переносов строк и преобразуем пустые параграфы
    const cleanedContent = cleanupContent(localContent().trim())

    if (isContentEmpty(cleanedContent)) {
      toast.error(t('Comment cannot be empty'))
      return
    }

    setPosting(true)
    // Сохраняем позицию скролла только для редактирования
    const isEdit = editingCommentId() !== undefined
    const isReply = clickedReplyId() !== undefined

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
        toast.error(t('Comment cannot be empty'))
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

      console.log('[CommentsTree] Processing edit:', { commentId, isEdit })

      const commentToEdit = isEdit ? comments().find((c) => c.id === commentId) : undefined
      if (isEdit && !commentToEdit) {
        console.error('[CommentsTree] Comment not found for editing:', commentId)
        toast.error(t('Comment not found'))
        setPosting(false)
        return
      }

      // Отправляем запрос на сервер
      const input = isEdit
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
        operation: isEdit ? 'update' : 'create',
        commentId: isEdit ? commentId : undefined,
        replyTo: isEdit ? commentToEdit?.reply_to : parentId
      })

      // Очищаем форму и состояния до отправки запроса для режима редактирования
      if (isEdit) {
        // Удаляем локальную версию при сохранении
        const draftKey = `draft-${props.shoutId}-comment-edit-${commentId}`
        removeDraftByKey(draftKey)
        handleClear()
      } else if (isReply) {
        // Удаляем локальную версию при отправке ответа
        const draftKey = `draft-${props.shoutId}-comment-${clickedReplyId()}`
        removeDraftByKey(draftKey)
      } else {
        // Удаляем локальную версию при отправке нового комментария
        const draftKey = `draft-${props.shoutId}-comment-new`
        removeDraftByKey(draftKey)
      }

      const result = isEdit ? await updateShoutReaction(input) : await createShoutReaction(input)

      console.log('[CommentsTree] Got response:', result)

      // Если результат - объект но не содержит id, это может указывать на проблему
      if (result && typeof result === 'object' && !('error' in result) && !('id' in result)) {
        console.warn('[CommentsTree] Странный формат ответа от сервера:', result)
      }

      // Только при успешном ответе обрабатываем результат
      if (result && !('error' in result)) {
        const serverData = result as Reaction

        if (isEdit) {
          // Для редактирования обновляем только существующий комментарий
          console.log('[CommentsTree] Comment updated successfully')

          // Добавляем обновленный комментарий в хранилище реакций
          addShoutReactions([serverData])

          // Очищаем состояние после успешного редактирования
          handleSubmitSuccess()

          toast.success(t('Comment updated'))
        } else {
          // Для новых комментариев добавляем результат с сервера
          console.log('[CommentsTree] Comment created successfully')

          // Добавляем новый комментарий в хранилище реакций
          addShoutReactions([serverData])

          // Очищаем состояние после успешного создания
          handleSubmitSuccess()

          toast.success(t('Comment saved'))

          // Прокручиваем к новому комментарию с небольшой задержкой для обновления DOM
          scrollToComment(serverData.id, true, 300)
        }
      }
    } catch (error) {
      console.error('[CommentsTree] Error submitting comment:', error)
      toast.error(t('Failed to save comment'))
    } finally {
      setPosting(false)
    }
  }

  const handleClear = () => {
    const commentId = editingCommentId()
    const replyId = clickedReplyId()

    // Определяем ключ черновика
    const draftKey =
      commentId !== undefined
        ? `draft-${props.shoutId}-comment-edit-${commentId}`
        : replyId !== undefined
          ? `draft-${props.shoutId}-comment-${replyId}`
          : `draft-${props.shoutId}-comment-new`

    // Сбрасываем состояния атомарно, чтобы избежать лишних ререндеров
    batch(() => {
      setEditingCommentId(undefined)
      setClickedReplyId(undefined)

      // Если мы отменяем ответ или редактирование, восстанавливаем основной редактор
      if (commentId !== undefined || replyId !== undefined) {
        // Восстанавливаем состояние основного редактора
        const savedMainContent = mainEditorContent()
        setLocalContent(savedMainContent)

        // Удаляем временные данные редактирования
        if (commentId !== undefined) {
          // Если была отмена редактирования, удаляем локальную версию
          removeDraftByKey(draftKey)
          setEditorContent(draftKey, '')
        }
      } else {
        // Очищаем только контент основного редактора при отмене нового комментария
        // Но НЕ удаляем сам редактор - оставляем его видимым и пустым
        setLocalContent('')
        setMainEditorContent('')
        setEditorContent(draftKey, '')
      }
    })

    // Очищаем фактическое содержимое редактора
    try {
      // Находим конкретный редактор по его ID вместо общего селектора
      const editor = document.querySelector(`[data-editor-id="${draftKey}"]`)
      if (editor) {
        if (commentId !== undefined || replyId !== undefined) {
          // Если это редактирование или ответ, очищаем редактор
          editor.innerHTML = ''
        } else {
          // Если это основной редактор, то восстанавливаем сохраненное содержимое
          const savedContent = mainEditorContent()
          if (savedContent) {
            editor.innerHTML = savedContent
          } else {
            editor.innerHTML = ''
          }
        }

        // Вызываем событие input для обновления состояния
        editor.dispatchEvent(new Event('input', { bubbles: true }))
      }
    } catch (error) {
      console.warn('[CommentsTree] Error handling editor content:', error)
    }

    console.log('[CommentsTree] Editor state updated')
  }

  const handleReply = (replyToCommentId: number) => {
    if (!replyToCommentId) return
    if (!session()?.author) {
      toast.error(t('Please sign in to reply'))
      return
    }

    // Сохраняем текущее содержимое редактора, если мы в режиме ввода нового комментария
    if (!clickedReplyId() && !editingCommentId()) {
      const currentContent = localContent()
      if (currentContent && !isContentEmpty(currentContent)) {
        console.log('[CommentsTree] Saving main editor content before switching to reply mode')
        setMainEditorContent(currentContent)

        // Сохраняем в черновик через контекст
        setEditorContent(`draft-${props.shoutId}-comment-new`, currentContent)
      }
    }

    // Если мы уже отвечаем на другой комментарий, сохраняем его содержимое
    const currentReplyId = clickedReplyId()
    if (currentReplyId && currentReplyId !== replyToCommentId) {
      const currentContent = localContent()
      if (currentContent && !isContentEmpty(currentContent)) {
        console.log(`[CommentsTree] Saving reply content for comment #${currentReplyId}`)
        setReplyEditorContents((prev) => ({ ...prev, [`${currentReplyId}`]: currentContent }))

        // Сохраняем в черновик через контекст
        setEditorContent(`draft-${props.shoutId}-comment-${currentReplyId}`, currentContent)
      }
    }

    // Обновляем состояние без очистки сохраненного контента
    batch(() => {
      // Сбрасываем активное состояние редактирования
      setEditingCommentId(undefined)

      // Устанавливаем новый режим ответа
      setClickedReplyId(replyToCommentId)

      // Загружаем существующий контент для данного ответа, если он есть, через getEditorContent
      const savedReplyContent =
        replyEditorContents()[`${replyToCommentId}`] ||
        getEditorContent(`draft-${props.shoutId}-comment-${replyToCommentId}`) ||
        ''

      // Устанавливаем контент в локальное состояние
      setLocalContent(savedReplyContent)
    })

    console.log(`[CommentsTree] Switched to reply mode for comment #${replyToCommentId}`)
  }

  const handleEdit = (commentId: number) => {
    if (!commentId) return
    if (!session()?.author) {
      toast.error(t('Please sign in to edit'))
      return
    }

    const commentToEdit = comments().find((c) => c.id === commentId)
    if (!commentToEdit) {
      toast.error(t('Comment not found'))
      return
    }

    // Сохраняем текущее содержимое основного редактора, если мы в режиме ввода нового комментария
    if (!clickedReplyId() && !editingCommentId()) {
      const currentContent = localContent()
      if (currentContent && !isContentEmpty(currentContent)) {
        console.log('[CommentsTree] Saving main editor content before switching to edit mode')
        setMainEditorContent(currentContent)

        // Сохраняем в черновик через контекст
        setEditorContent(`draft-${props.shoutId}-comment-new`, currentContent)
      }
    }

    // Если мы отвечаем на комментарий, сохраняем его содержимое
    const currentReplyId = clickedReplyId()
    if (currentReplyId) {
      const currentContent = localContent()
      if (currentContent && !isContentEmpty(currentContent)) {
        console.log(`[CommentsTree] Saving reply content for comment #${currentReplyId}`)
        setReplyEditorContents((prev) => ({ ...prev, [`${currentReplyId}`]: currentContent }))

        // Сохраняем в черновик через контекст
        setEditorContent(`draft-${props.shoutId}-comment-${currentReplyId}`, currentContent)
      }
    }

    batch(() => {
      // Сбрасываем режим ответа
      setClickedReplyId(undefined)

      // Устанавливаем режим редактирования
      setEditingCommentId(commentId)

      // Получаем содержимое комментария для редактирования из getEditorContent
      const editContent =
        getEditorContent(`draft-${props.shoutId}-comment-edit-${commentId}`) || commentToEdit.body || ''

      // Устанавливаем контент для редактирования
      setLocalContent(editContent)
      setEditorContent(`draft-${props.shoutId}-comment-edit-${commentId}`, editContent)
    })
  }

  /**
   * Обработчик для удаления комментария
   */
  const handleDelete = async (id: number) => {
    if (!id) return
    if (!session()?.author) {
      toast.error(t('Please sign in to delete'))
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
            toast.success(t('Comment restored'))
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
        toast.error(t('Failed to delete comment'))

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
      toast.success(t('Comment deleted'))

      // Обновляем колбэк только при успешном удалении на сервере
      if (props.onDeleteComment) {
        props.onDeleteComment(id)
      }
    } catch (error) {
      console.error('[CommentsTree] Error deleting comment:', error)
      toast.error(t('Failed to delete comment'))

      // Пытаемся восстановить комментарий при ошибке
      const commentToRestore = comments().find((c) => c.id === id)
      if (commentToRestore) {
        setTimeout(() => {
          addShoutReactions([commentToRestore])
        }, 100)
      }
    }
  }

  const toggleNewOnly = () => {
    const newValue = !onlyNew()

    batch(() => {
      setOnlyNew(newValue)

      // При включении режима "только новые" обновляем отображаемые комментарии
      if (newValue && newComments().length > 0) {
        // При включении режима "только новые" снимаем выбранность со всех типов сортировки
        console.log('[CommentsTree] Режим "только новые" включен, показываем', newComments().length, 'комментариев')
      } else {
        console.log('[CommentsTree] Режим "только новые" выключен, показываем все комментарии')
        // Восстанавливаем обычное отображение видимых комментариев
        updateCommentsCount()
      }
    })
  }

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
            // Исключаем собственные комментарии из списка новых
            if (session()?.author?.id === c.created_by?.id) {
              return false
            }

            // Комментарий считается новым, если он создан или обновлен после последнего просмотра
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
    // Для нового комментария кнопки показываем только если есть контент
    // Для редактирования и ответов - всегда показываем
    const shouldShowButtons = props.mode !== 'new' || !props.isDisabled

    return (
      <div
        class={clsx(styles.editingButtonsWrapper, {
          [styles.hidden]: !shouldShowButtons
        })}
      >
        <Button variant="secondary" value={t('Cancel')} onClick={props.onCancel} />
        <Button
          value={t(posting() ? 'Saving...' : 'Save')}
          variant="primary"
          onClick={props.onSave}
          disabled={posting() || props.isDisabled}
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
   * Компонент ветки комментариев с поддержкой пагинации
   */
  const CommentBranch = (props: {
    parentId: number
    shoutId: number
    articleAuthors?: Author[]
    totalComments?: number
  }) => {
    const { t } = useLocalize()
    const [repliesOffset, setRepliesOffset] = createSignal(0)
    const [isLoadingReplies, setIsLoadingReplies] = createSignal(false)
    const [hasMoreReplies, setHasMoreReplies] = createSignal(false)
    const [remainingRepliesCount, setRemainingRepliesCount] = createSignal(0)

    // Получаем общее количество комментариев из родительского компонента или свойств
    const totalCommentsCount = () =>
      props.totalComments !== undefined ? props.totalComments : props.totalComments === 0 ? 0 : 30

    // Индикатор, показывающий, были ли когда-либо загружены ответы
    const [hasLoadedReplies, setHasLoadedReplies] = createSignal(false)

    // Получаем родительский комментарий
    const parentComment = createMemo(() => {
      const comment = comments().find((c) => c.id === props.parentId)
      if (!comment) {
        console.warn(`[CommentBranch] Parent comment #${props.parentId} not found in comments list`)
      }
      return comment
    })

    // Получаем загруженные ответы
    const loadedReplies = createMemo(() => {
      // Использовать дерево комментариев для получения ответов
      const replies = commentTree()[props.parentId] || []

      // Если у нас есть first_replies и дерево ещё не сформировано или пусто, используем их
      const parent = parentComment()
      if (
        replies.length === 0 &&
        parent &&
        parent.first_replies &&
        parent.first_replies.length > 0 &&
        !hasLoadedReplies()
      ) {
        console.log(
          `[CommentBranch] Using first_replies for comment #${props.parentId}: ${parent.first_replies.length} replies`
        )
        return parent.first_replies as Reaction[]
      }

      if (replies.length > 0) {
        console.log(`[CommentBranch] Using tree replies for comment #${props.parentId}: ${replies.length} replies`)
      } else {
        console.log(`[CommentBranch] No replies found for comment #${props.parentId}`)
      }

      return replies
    })

    // Определяем, есть ли еще ответы для загрузки
    createEffect(() => {
      const parent = parentComment()
      const replies = loadedReplies()

      if (parent && 'stat' in parent && parent.stat) {
        // Общее количество ответов из API (если есть)
        // Используем comments_count, если он доступен, иначе 0
        const totalReplies: number =
          parent.stat.comments_count !== undefined ? (parent.stat.comments_count as number) : 0

        // Количество уже загруженных ответов
        const loadedCount = replies.length

        // Есть еще ответы для загрузки, если загружено меньше, чем общее количество
        untrack(() => {
          console.log(
            `[CommentBranch] Комментарий #${props.parentId}: всего ответов ${totalReplies}, загружено ${loadedCount}`
          )

          const moreReplies = loadedCount < totalReplies
          setHasMoreReplies(moreReplies)
          setRemainingRepliesCount(Math.max(0, totalReplies - loadedCount))

          // Проверяем, нужно ли загружать ответы сразу если их всего мало
          const shouldAutoLoad =
            !hasLoadedReplies() &&
            totalCommentsCount() < 30 &&
            totalReplies > 0 &&
            totalReplies <= 5 &&
            loadedCount < totalReplies

          if (shouldAutoLoad) {
            console.log(`[CommentBranch] Auto-loading ${totalReplies} replies for comment #${props.parentId}`)
            // Автоматически загружаем небольшое количество ответов на маленьких страницах
            setTimeout(() => loadMoreReplies(), 100)
          }

          if (loadedCount > 0) {
            setHasLoadedReplies(true)
          }

          setRepliesOffset(loadedCount)
        })
      } else if (parent) {
        // Тихо логируем и предполагаем, что ответов нет
        console.log(`[CommentBranch] Comment #${props.parentId} has no stat.comments_count property`)
        untrack(() => {
          setHasMoreReplies(false)
          setRemainingRepliesCount(0)
        })
      } else {
        console.warn(`[CommentBranch] No parent comment found for #${props.parentId}`)
      }
    })

    /**
     * Загружает дополнительные ответы для текущей ветки
     */
    const loadMoreReplies = async (e?: Event) => {
      if (e) e.preventDefault()
      if (isLoadingReplies()) return

      setIsLoadingReplies(true)
      try {
        console.log(`[CommentBranch] Loading more replies for comment #${props.parentId}, offset: ${repliesOffset()}`)

        // Определяем адаптивный лимит загрузки
        // Используем Math.floor для обеспечения целочисленного значения
        const repliesLimit = totalCommentsCount() < 30 ? null : Math.floor(COMMENTS_PER_PAGE / 2)
        console.log(`[CommentBranch] Using replies limit: ${repliesLimit || 'unlimited'}`)

        // Используем существующую функцию loadCommentReplies
        const replies = await loadCommentsBranch({
          shout: props.shoutId,
          parent_id: props.parentId,
          limit: repliesLimit,
          offset: repliesOffset(),
          sort:
            commentsOrder() === 'newest'
              ? ReactionSort.Newest
              : commentsOrder() === 'oldest'
                ? ReactionSort.Oldest
                : ReactionSort.Like
        })

        if (!replies || replies.length === 0) {
          console.log(`[CommentBranch] No more replies loaded for comment #${props.parentId}`)
          setHasMoreReplies(false)
          setRemainingRepliesCount(0)
          return
        }

        console.log(`[CommentBranch] Loaded ${replies.length} replies for comment #${props.parentId}`)

        // Добавляем загруженные ответы в хранилище
        untrack(() => {
          const beforeCount = Object.keys(reactionEntities()).length
          addShoutReactions(replies)
          const afterCount = Object.keys(reactionEntities()).length

          console.log(`[CommentBranch] Added ${afterCount - beforeCount} replies to store`)
          setHasLoadedReplies(true)
        })

        // Проверяем наличие дополнительных ответов после загрузки
        const parent = parentComment()
        if (parent?.stat && parent.stat.comments_count !== undefined) {
          const totalReplies: number = parent.stat.comments_count as number
          const newOffset = repliesOffset() + replies.length

          // Обновляем смещение для следующей загрузки
          setRepliesOffset(newOffset)

          // Обновляем оставшееся количество ответов
          const remaining = Math.max(0, totalReplies - newOffset)
          setRemainingRepliesCount(remaining)

          // Определяем, есть ли еще ответы для загрузки
          const hasMore = newOffset < totalReplies
          setHasMoreReplies(hasMore)

          console.log(
            `[CommentBranch] После загрузки #${props.parentId}: всего ${totalReplies}, загружено ${newOffset}, осталось ${remaining}`
          )
        } else {
          // Если нет информации о количестве ответов, используем эвристику
          setHasMoreReplies(replies.length === COMMENTS_PER_PAGE / 2)
          setRemainingRepliesCount(replies.length === COMMENTS_PER_PAGE / 2 ? COMMENTS_PER_PAGE / 2 : 0)
        }
      } catch (error) {
        console.error('[CommentBranch] Error loading replies:', error)
        toast.error(t('Failed to load replies'))
      } finally {
        setIsLoadingReplies(false)
      }
    }

    // Форсируем пересчет дерева при монтировании
    onMount(() => {
      const parent = parentComment()
      if (parent) {
        // Безопасно получаем количество ответов, используя значение по умолчанию 0
        const totalReplies = parent.stat?.comments_count !== undefined ? parent.stat.comments_count : 0
        const firstRepliesCount = parent.first_replies?.length || 0
        const treeRepliesCount = commentTree()[props.parentId]?.length || 0

        console.log(`[CommentBranch] Mounted for comment #${props.parentId}:`, {
          totalReplies,
          firstRepliesCount,
          treeRepliesCount
        })

        // Добавляем first_replies в хранилище, если они есть и еще не в дереве
        if (firstRepliesCount > 0 && treeRepliesCount === 0 && parent.first_replies) {
          console.log(
            `[CommentBranch] Adding ${firstRepliesCount} first_replies to store for comment #${props.parentId}`
          )
          untrack(() => {
            addShoutReactions(parent.first_replies as Reaction[])
          })
        }
      }
    })

    return (
      <>
        {/* Форма ответа */}
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

        {/* Дочерние комментарии */}
        <Show when={loadedReplies().length > 0 || untrack(() => hasMoreReplies())}>
          <ul class={clsx(styles.commentsList)}>
            <For each={loadedReplies()} fallback={null}>
              {(comment) => (
                <li class={styles.commentItem} data-comment-id={comment.id} id={`comment-${comment.id}`}>
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
                    onLoadReplies={loadCommentReplies}
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
                      totalComments={props.totalComments}
                    />
                  </CommentCard>
                </li>
              )}
            </For>

            {/* Ненавязчивая серая ссылка для загрузки дополнительных ответов */}
            <Show when={untrack(() => hasMoreReplies()) && untrack(() => remainingRepliesCount() > 0)}>
              <li>
                <a href="#" class={styles.loadMoreRepliesLink} onClick={loadMoreReplies}>
                  <Show when={isLoadingReplies()} fallback={<span class={styles.icon}>↳</span>}>
                    <span class={styles.loadingIndicator}>
                      <Loading />
                    </span>
                  </Show>
                  <Show when={!isLoadingReplies()} fallback={<Loading />}>
                    {t('Show more')}{' '}
                    {t('replies', {
                      count: untrack(() => remainingRepliesCount())
                    })}
                  </Show>
                </a>
              </li>
            </Show>
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

    // Сохраняем в черновик и в локальное состояние для основного редактора
    if (!clickedReplyId() && !editingCommentId()) {
      setMainEditorContent(data.content)
      // Сохраняем черновик основного редактора через контекст
      setEditorContent(`draft-${props.shoutId}-comment-new`, data.content)
    }

    untrack(() => setEditorContent(`draft-${props.shoutId}-comment-new`, localContent()))
  }

  /**
   * Обработчик изменений в форме ответа на комментарий
   */
  const handleReplyEditorChange = (data: EditorData) => {
    // Обязательно получаем replyId с проверкой типа
    const maybeReplyId = clickedReplyId()

    // Если replyId не существует, ничего не делаем
    if (maybeReplyId === undefined) {
      console.warn('[CommentsTree] Reply ID is undefined')
      return
    }

    // Теперь у нас точно есть ID
    const replyId = maybeReplyId

    console.log('[CommentsTree] Reply editor onChange:', {
      replyTo: replyId,
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
    const finalContent = hasEmptyParagraphs || hasExcessiveBreaks ? cleanupContent(data.content) : data.content

    // Устанавливаем очищенный контент
    setLocalContent(finalContent)

    // Сохраняем в локальное состояние для ответа
    setReplyEditorContents((prev) => {
      const newState = { ...prev }
      newState[`${replyId}`] = finalContent // Преобразуем ID в строку для использования как ключа
      return newState
    })

    // Сохраняем в черновик
    const draftKey = `draft-${props.shoutId}-comment-${replyId}`
    untrack(() => setEditorContent(draftKey, finalContent))
  }

  // Обновленная функция для загрузки комментариев с использованием API веток
  const loadRootCommentsWithReplies = async (offset: number): Promise<LoadMoreItems | undefined> => {
    // Уникальный ключ для этой загрузки
    const loadKey = `comments_${props.shoutId}_${offset}`

    // Проверяем, была ли уже выполнена эта загрузка
    const isAlreadyLoaded = () => {
      try {
        return sessionStorage.getItem(loadKey) === 'loaded'
      } catch {
        return false
      }
    }

    // Отмечаем загрузку как выполненную
    const markAsLoaded = () => {
      try {
        sessionStorage.setItem(loadKey, 'loaded')
      } catch {
        // Игнорируем ошибки sessionStorage
      }
    }

    console.log('[CommentsTree] Loading root comments from offset:', offset)

    // Проверяем, не была ли эта конкретная страница уже загружена ранее
    if (isAlreadyLoaded()) {
      console.log('[CommentsTree] Comments at offset', offset, 'already loaded, skipping')
      return []
    }

    // Проверка на уже выполняющуюся загрузку
    if (untrack(() => isLoading())) {
      console.log('[CommentsTree] Already loading comments, skipping request')
      return undefined
    }

    try {
      // Устанавливаем флаг загрузки вне отслеживания реактивности
      untrack(() => setIsLoading(true))

      // Определяем лимит загрузки дочерних комментариев:
      // - без лимита (null), если всего комментариев < 30
      // - 3 комментария, если комментариев >= 30
      const childrenLimit = props.totalComments < 30 ? null : 3
      console.log(`[CommentsTree] Loading more comments with offset ${offset}, children_limit: ${childrenLimit}`)

      // Получаем текущий список корневых комментариев для отладки
      const currentRootComments = commentTree()[0]?.length || 0
      console.log(`[CommentsTree] Before loading more: ${currentRootComments} root comments in tree`)

      // Используем API для загрузки комментариев с предзагрузкой ответов
      const response = await loadCommentsBranch({
        shout: props.shoutId,
        parent_id: null, // Загружаем корневые комментарии
        limit: COMMENTS_PER_PAGE,
        offset,
        sort:
          commentsOrder() === 'newest'
            ? ReactionSort.Newest
            : commentsOrder() === 'oldest'
              ? ReactionSort.Oldest
              : ReactionSort.Like,
        children_limit: childrenLimit // Загружаем все ответы или только 3 в зависимости от общего количества
      })

      // Отмечаем, что загрузка для этого offset выполнена
      markAsLoaded()

      if (!response || response.length === 0) {
        console.log('[CommentsTree] No more root comments to load')
        untrack(() => setLoadMoreHidden(true))
        return []
      }

      console.log(`[CommentsTree] Loaded ${response.length} more root comments`)

      // Обработка полученных данных - добавляем в хранилище как корневые комментарии,
      // так и их предзагруженные ответы
      untrack(() => {
        // Проверяем текущее состояние хранилища
        const beforeCount = Object.keys(reactionEntities()).length

        const allComments: Reaction[] = []
        let firstRepliesCount = 0

        // Собираем все комментарии и их предзагруженные ответы
        response.forEach((comment: Reaction) => {
          if (!comment) {
            console.warn('[CommentsTree] Received undefined comment in response')
            return
          }

          // Проверяем корректность ID
          if (!comment.id) {
            console.warn('[CommentsTree] Comment without ID detected in response')
            return
          }

          allComments.push(comment)

          // Добавляем first_replies, если они есть
          if (comment.first_replies && comment.first_replies.length > 0) {
            const replies = (comment.first_replies || []) as Reaction[]

            // Логируем информацию о предзагруженных ответах
            console.log(`[CommentsTree] Комментарий #${comment.id} содержит ${replies.length} предзагруженных ответов`)

            // Проверяем, что это массив перед добавлением
            if (Array.isArray(replies)) {
              // Проверяем каждый ответ на валидность
              for (const reply of replies) {
                if (reply?.id) {
                  allComments.push(reply)
                  firstRepliesCount++
                } else {
                  console.warn('[CommentsTree] Invalid reply in first_replies:', reply)
                }
              }
            }
          }
        })

        // Явно добавляем все собранные комментарии и ответы в хранилище
        if (allComments.length > 0) {
          addShoutReactions(allComments)

          // Проверяем, сколько комментариев было добавлено
          const afterCount = Object.keys(reactionEntities()).length
          const addedCount = afterCount - beforeCount

          console.log(
            `[CommentsTree] Всего добавлено ${addedCount} комментариев (${beforeCount} -> ${afterCount}): ${response.length} корневых и ${firstRepliesCount} ответов`
          )
        } else {
          console.warn('[CommentsTree] No comments to add from response')
        }

        // Проверяем, есть ли еще комментарии для загрузки
        const shouldHideLoadMore = response.length < COMMENTS_PER_PAGE
        console.log(
          `[CommentsTree] Should hide "Load More"? ${shouldHideLoadMore} (loaded: ${response.length}, pageSize: ${COMMENTS_PER_PAGE})`
        )
        setLoadMoreHidden(shouldHideLoadMore)

        // Принудительно проверяем дерево комментариев
        setTimeout(() => {
          const newRootComments = commentTree()[0]?.length || 0
          console.log(
            `[CommentsTree] After loading more: ${newRootComments} root comments in tree (was: ${currentRootComments})`
          )
        }, 0)
      })

      // Обновляем рейтинги для новых комментариев вне отслеживания реактивности
      untrack(() => refetchRates())

      return response as LoadMoreItems
    } catch (error) {
      console.error('[CommentsTree] Error loading comments:', error)
      toast.error(t('Failed to load comments'))
      return undefined
    } finally {
      // Сбрасываем флаг загрузки вне отслеживания реактивности
      untrack(() => setIsLoading(false))
    }
  }

  // Обновленная функция для загрузки ответов на комментарий
  const loadCommentReplies = async (commentId: number, offset = 0): Promise<Reaction[]> => {
    console.log('[CommentsTree] Loading replies for comment:', commentId, 'offset:', offset)

    try {
      // Определяем лимит загрузки:
      // - null (все комментарии), если общее количество < 30
      // - Целое число (COMMENTS_PER_PAGE / 2), если общее количество >= 30
      const repliesLimit = props.totalComments < 30 ? null : Math.floor(COMMENTS_PER_PAGE / 2)

      // Используем API веток для загрузки ответов
      const response = await loadCommentsBranch({
        shout: props.shoutId,
        parent_id: commentId,
        limit: repliesLimit, // Динамический лимит в зависимости от общего количества комментариев
        offset,
        sort:
          commentsOrder() === 'newest'
            ? ReactionSort.Newest
            : commentsOrder() === 'oldest'
              ? ReactionSort.Oldest
              : ReactionSort.Like
      })

      if (response && response.length > 0) {
        console.log('[CommentsTree] Loaded replies:', response.length)

        // Добавляем ответы в хранилище вне отслеживания реактивности
        untrack(() => addShoutReactions(response))
      }

      return response || []
    } catch (error) {
      console.error('[CommentsTree] Error loading replies:', error)
      toast.error(t('Failed to load replies'))
      return []
    }
  }

  /**
   * Обновляет данные о количестве комментариев
   */
  const updateCommentsCount = () => {
    // Получаем все комментарии для текущего shout
    const allComments = comments().filter((c) => c.shout && Number(c.shout) === props.shoutId)

    // Количество корневых комментариев (без родителя)
    const rootComments = allComments.filter((c) => !c.reply_to).length

    // Используем пропс totalComments как основу для отображения общего количества
    const totalCount = props.totalComments || allComments.length

    console.log(
      `[CommentsTree] Статистика комментариев: всего ${totalCount}, загружено ${allComments.length}, корневых ${rootComments}`
    )
  }

  // Обновляем счетчики при изменении комментариев
  createEffect(() => {
    // Отслеживаем изменения в коллекции комментариев
    const _ = comments()
    updateCommentsCount()
  })

  // Обеспечиваем правильное отображение загруженных комментариев
  createEffect(() => {
    if (!isLoading() && comments().length > 0) {
      // Добавляем проверку, видимы ли комментарии в дереве
      const rootComments = commentTree()[0]?.length || 0
      const totalUniqueComments = new Set(comments().map((c) => c.id)).size

      console.log(
        `[CommentsTree] Visibility check: displaying ${rootComments} root comments out of ${totalUniqueComments} unique loaded comments (total expected: ${props.totalComments})`
      )

      // Если есть несоответствие между загруженными и отображаемыми комментариями, обновляем дерево
      if (rootComments === 0 && totalUniqueComments > 0) {
        console.log('[CommentsTree] Detected visibility issue, forcing comment tree refresh')
        // Принудительно пересортируем комментарии, чтобы обновить дерево
        setCommentsOrder((prev) => {
          setTimeout(() => setCommentsOrder(prev), 0)
          return prev
        })
      }
    }
  })

  // После успешной отправки комментария обновляем состояние
  const handleSubmitSuccess = () => {
    console.log('[CommentsTree] Comment submitted successfully, clearing state')

    // Очищаем редактор
    const draftKey =
      editingCommentId() !== undefined
        ? `draft-${props.shoutId}-comment-edit-${editingCommentId()}`
        : clickedReplyId() !== undefined
          ? `draft-${props.shoutId}-comment-${clickedReplyId()}`
          : `draft-${props.shoutId}-comment-new`

    // Удаляем локальные версии
    removeDraftByKey(draftKey)
    setEditorContent(draftKey, '')

    // Если это был основной редактор, очищаем его сохраненное состояние
    if (!clickedReplyId() && !editingCommentId()) {
      setMainEditorContent('')
    }

    // Если это был ответ, очищаем его сохраненное состояние
    if (clickedReplyId()) {
      const replyId = clickedReplyId()
      if (replyId !== undefined) {
        setReplyEditorContents((prev) => {
          const updated = { ...prev }
          delete updated[`${replyId}`] // Используем строковый ключ
          return updated
        })
      }
    }

    // Сбрасываем состояния редактирования
    batch(() => {
      setEditingCommentId(undefined)
      setClickedReplyId(undefined)
      setLocalContent('')
    })

    // Находим и очищаем DOM элемент редактора
    try {
      const editor = document.querySelector(`[data-editor-id="${draftKey}"]`)
      if (editor) {
        editor.innerHTML = ''
        // Вызываем событие input для обновления состояния
        editor.dispatchEvent(new Event('input', { bubbles: true }))
      }
    } catch (error) {
      console.warn('[CommentsTree] Error clearing editor content:', error)
    }
  }

  // Показываем основной редактор только если не редактируем комментарий и не отвечаем на комментарий
  const showMainEditor = () => {
    return !clickedReplyId() && !editingCommentId()
  }

  // Проверяем, должна ли кнопка "Сохранить" быть активной для основного редактора
  const shouldEnableMainSaveButton = () => {
    return !isContentEmpty(localContent())
  }

  return (
    <ErrorBoundary fallback={(err) => <div>Error: {err.toString()}</div>}>
      <div>
        <Show when={!isLoading()} fallback={<Loading />}>
          {/* Показываем основной редактор только если не редактируем комментарий и не отвечаем на комментарий */}
          <Show when={showMainEditor()}>
            <ShowIfAuthenticated fallback={<FallbackMessage />}>
              <div>
                <SimpleRichEditor
                  toolbar="bottom"
                  editorId={`draft-${props.shoutId}-comment-new`}
                  commands={['bold', 'italic', 'link', 'blockquote', 'image']}
                  placeholder={t('Write a comment...')}
                  onChange={handleEditorChange}
                  onBlur={() => handleEditorBlur(`draft-${props.shoutId}-comment-new`)}
                  // Инициализируем контент основного редактора из getEditorContent
                  content={
                    mainEditorContent() || // Сначала пробуем состояние UI
                    getEditorContent(`draft-${props.shoutId}-comment-new`) || // Затем черновик
                    ''
                  }
                />
                <EditorControls
                  mode="new"
                  onSave={() => handleSubmitComment(undefined)}
                  onCancel={() => handleClear()}
                  isDisabled={!shouldEnableMainSaveButton()}
                />
              </div>
            </ShowIfAuthenticated>
          </Show>

          <CommentsHeader
            comments={comments().length} // Передаем количество комментариев
            newComments={newComments().length} // Передаем количество новых комментариев
            setOrder={setCommentsOrder}
            order={commentsOrder() as ReactionSort}
            onlyNew={onlyNew()}
            toggleNewOnly={toggleNewOnly}
          />

          <Show when={comments().length > 0}>
            <div class={clsx(styles.commentsListContainer)}>
              <LoadMoreWrapper
                loadFunction={loadRootCommentsWithReplies}
                pageSize={COMMENTS_PER_PAGE}
                hidden={loadMoreHidden()}
                useScrollTrigger={true}
                loadMoreText={t('Loading more comments...')}
              >
                <ul class={clsx(styles.commentsList)}>
                  <For
                    each={(() => {
                      // Получаем корневые комментарии из дерева или напрямую, если дерево пусто
                      let rootComments = onlyNew()
                        ? commentTree()[0]?.filter((c) => newComments().some((nc) => nc.id === c.id))
                        : commentTree()[0]

                      // Если дерево пустое, но комментарии загружены, используем их напрямую
                      if (!rootComments?.length && comments().length > 0 && !onlyNew()) {
                        console.log('[CommentsTree] Tree is empty but comments exist, showing them directly')
                        rootComments = comments().filter((c) => !c.reply_to)

                        // Сортируем комментарии согласно выбранному порядку
                        if (commentsOrder() === 'newest') {
                          rootComments.sort(
                            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                          )
                        } else if (commentsOrder() === 'oldest') {
                          rootComments.sort(
                            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                          )
                        } else if (commentsOrder() === 'popular') {
                          rootComments.sort((a, b) => {
                            const aRate = a.stat?.rating ?? 0
                            const bRate = b.stat?.rating ?? 0
                            return bRate - aRate || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                          })
                        }
                      }

                      return rootComments || []
                    })()}
                    fallback={<div class={styles.noComments}>{t('No comments yet')}</div>}
                  >
                    {(comment) => (
                      <li class={styles.commentItem} data-comment-id={comment.id} id={`comment-${comment.id}`}>
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
                          onLoadReplies={loadCommentReplies}
                          content={
                            editingCommentId() === comment.id
                              ? localContent() || // Сначала состояние UI
                                getEditorContent(`draft-${props.shoutId}-comment-edit-${comment.id}`) || // Затем черновик
                                comment.body || // Иначе из комментария
                                ''
                              : undefined // Не передаем контент, если не редактируем
                          }
                        >
                          <CommentBranch
                            parentId={comment.id}
                            shoutId={props.shoutId}
                            articleAuthors={props.articleAuthors}
                            totalComments={props.totalComments}
                          />
                        </CommentCard>
                      </li>
                    )}
                  </For>
                </ul>
              </LoadMoreWrapper>
            </div>
          </Show>
        </Show>
      </div>
    </ErrorBoundary>
  )
}
