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
import { EditorData, SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { Button } from '../_shared/Button'
import { LoadMoreItems } from '../_shared/LoadMoreWrapper'
import { Loading } from '../_shared/Loading'
import { ShowIfAuthenticated } from '../_shared/ShowIfAuthenticated'
import { CommentCard } from './CommentCard'
import { CommentsHeader } from './CommentsHeader'

import styles from './CommentsTree.module.scss'

const COMMENTS_PER_PAGE = 20

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
    return allReactions.filter((r) => r.kind === ReactionKind.Comment && r.shout?.slug === props.shoutSlug)
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

    sorted.forEach((comment) => {
      const parentId = comment.reply_to || 0
      if (!tree[parentId]) tree[parentId] = []
      tree[parentId].push(comment)
    })

    return tree
  })

  // Загрузка комментариев
  const [commentsResource, { refetch }] = createResource(
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

    const content = localContent().trim()
    if (isContentEmpty(content)) {
      showSnackbar({ type: 'error', body: t('Comment cannot be empty') })
      return
    }

    setPosting(true)
    const scrollPosition = window.scrollY

    try {
      const sanitizedContent = String(sanitizeHtml(content))
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
        return
      }

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

      // Очищаем форму и состояния
      handleClear()

      // Тихо обновляем данные с сервера
      await refetch()

      showSnackbar({ type: 'success', body: t(isEditing ? 'Comment updated' : 'Comment saved') })
      window.scrollTo(0, scrollPosition)
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

    // Сбрасываем состояния атомарно
    batch(() => {
      setEditingCommentId(undefined)
      setClickedReplyId(undefined)
      setLocalContent('')
    })
  }

  const handleReply = (commentId: number) => {
    if (!commentId) return
    if (!session()?.user) {
      showSnackbar({ type: 'error', body: t('Please sign in to reply') })
      return
    }

    batch(() => {
      setClickedReplyId(commentId)
      setEditingCommentId(undefined)
      setLocalContent('')
      setEditorContent(`draft-${props.shoutId}-comment-${commentId}`, '')
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
      setEditingCommentId(commentId)
      setClickedReplyId(undefined)
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
      const result = await deleteShoutReaction(id)
      if (result?.error) {
        showSnackbar({ type: 'error', body: t('Failed to delete comment') })
        return
      }

      showSnackbar({ type: 'success', body: t('Comment deleted') })
      if (props.onDeleteComment) {
        props.onDeleteComment(id)
      }
      await refetch()
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
    isDisabled: boolean
  }) => {
    return (
      <div
        class={clsx(styles.editingButtonsWrapper, {
          [styles.editingButtonsWrapperHidden]: props.isDisabled
        })}
      >
        <Button variant="secondary" value={t('Cancel')} onClick={handleClear} />
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

    const children = createMemo(() => {
      const branch = commentTree()[props.parentId] || []
      console.log('[CommentBranch] Children:', {
        parentId: props.parentId,
        count: branch.length
      })
      return branch
    })

    return (
      <Show when={children().length > 0 || clickedReplyId() === props.parentId}>
        <ul class={clsx(styles.commentsList)}>
          <Show when={clickedReplyId() === props.parentId}>
            <li class={styles.replyEditor}>
              <div>
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
                  isDisabled={isContentEmpty(localContent())}
                />
              </div>
            </li>
          </Show>
          <For each={children()}>
            {(comment) => (
              <>
                <Show when={editingCommentId() !== comment.id}>
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
                  >
                    <CommentBranch
                      parentId={comment.id}
                      shoutId={props.shoutId}
                      articleAuthors={props.articleAuthors}
                    />
                  </CommentCard>
                </Show>
                <Show when={editingCommentId() === comment.id}>
                  <li class={styles.editingComment}>
                    <div>
                      <SimpleRichEditor
                        editorId={`draft-${props.shoutId}-comment-edit-${comment.id}`}
                        commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                        placeholder={t('Edit your comment...')}
                        onChange={(data) => {
                          console.log('[CommentsTree] Edit editor onChange:', {
                            commentId: comment.id,
                            content: data.content,
                            isEmpty: data.isEmpty,
                            plainText: data.plainText
                          })
                          setLocalContent(data.content)
                          untrack(() =>
                            setEditorContent(
                              `draft-${props.shoutId}-comment-edit-${comment.id}`,
                              data.content
                            )
                          )
                        }}
                        content={getEditorContent(`draft-${props.shoutId}-comment-edit-${comment.id}`)}
                        toolbar="bottom"
                      />
                      <EditorControls
                        mode="edit"
                        onSave={() => {
                          console.log('[CommentsTree] Save button clicked in edit mode')
                          handleSubmitComment(undefined)
                        }}
                        isDisabled={isContentEmpty(localContent())}
                      />
                    </div>
                  </li>
                </Show>
              </>
            )}
          </For>
        </ul>
      </Show>
    )
  }

  const handleEditorBlur = (draftKey: string) => {
    const content = getEditorContent(draftKey)
    if (content) {
      const div = document.createElement('div')
      div.innerHTML = content

      // Рекурсивно удаляем пустые теги
      const removeEmptyTags = (element: Element) => {
        const children = Array.from(element.children)
        children.forEach((child) => {
          removeEmptyTags(child)
          // Проверяем есть ли текст или непустые дочерние элементы
          const hasText = child.textContent?.trim()
          const hasNonEmptyChildren = Array.from(child.children).some(
            (el) => el.textContent?.trim() || el.nodeName.toLowerCase() === 'img'
          )
          if (!hasText && !hasNonEmptyChildren) {
            child.remove()
          }
        })
      }

      removeEmptyTags(div)

      // Если после очистки контент пустой - очищаем редактор полностью
      if (!div.textContent?.trim() && !div.querySelector('img')) {
        batch(() => {
          setLocalContent('')
          setEditorContent(draftKey, '')

          // Очищаем содержимое редактора напрямую
          const editor = document.querySelector(`[data-editor-id="${draftKey}"]`)
          if (editor) {
            editor.innerHTML = ''
          }
        })
      }
    }
  }

  const handleEditorChange = (data: EditorData) => {
    console.log('[CommentsTree] New comment editor onChange:', {
      content: data.content,
      isEmpty: data.isEmpty
    })
    setLocalContent(data.content)
    untrack(() => setEditorContent(`draft-${props.shoutId}-comment-new`, data.content))
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
            <ul class={clsx(styles.commentsList)}>
              <For each={commentTree()[0] || []}>
                {(comment) => (
                  <>
                    <Show when={editingCommentId() !== comment.id}>
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
                      >
                        <CommentBranch
                          parentId={comment.id}
                          shoutId={props.shoutId}
                          articleAuthors={props.articleAuthors}
                        />
                      </CommentCard>
                    </Show>
                    <Show when={editingCommentId() === comment.id}>
                      <li class={styles.editingComment}>
                        <div>
                          <SimpleRichEditor
                            editorId={`draft-${props.shoutId}-comment-edit-${comment.id}`}
                            commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                            placeholder={t('Edit your comment...')}
                            onChange={(data) => {
                              console.log('[CommentsTree] Edit editor onChange:', {
                                commentId: comment.id,
                                content: data.content,
                                isEmpty: data.isEmpty,
                                plainText: data.plainText
                              })
                              setLocalContent(data.content)
                              untrack(() =>
                                setEditorContent(
                                  `draft-${props.shoutId}-comment-edit-${comment.id}`,
                                  data.content
                                )
                              )
                            }}
                            content={getEditorContent(`draft-${props.shoutId}-comment-edit-${comment.id}`)}
                            toolbar="bottom"
                          />
                          <EditorControls
                            mode="edit"
                            onSave={() => {
                              console.log('[CommentsTree] Save button clicked in edit mode')
                              handleSubmitComment(undefined)
                            }}
                            isDisabled={isContentEmpty(localContent())}
                          />
                        </div>
                      </li>
                    </Show>
                  </>
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
