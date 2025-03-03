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
import { useSnackbar, useUI } from '~/context/ui'
import {
  Author,
  MutationUpdate_ReactionArgs,
  Reaction,
  ReactionKind,
  ReactionSort
} from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { Button } from '../_shared/Button'
import { LoadMoreItems } from '../_shared/LoadMoreWrapper'
import { Loading } from '../_shared/Loading'
import { ShowIfAuthenticated } from '../_shared/ShowIfAuthenticated'
import { CommentCard } from './CommentCard'
import { CommentsHeader } from './CommentsHeader'

import styles from './CommentsTree.module.scss'

const COMMENTS_PER_PAGE = 20

type Props = {
  articleAuthors: Author[]
  shoutSlug: string
  shoutId: number
  onReply?: (id: number) => void
}

export const CommentsTree = (props: Props) => {
  const { session } = useSession()
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
  const { showConfirm } = useUI()

  // Добавим сигнал для отслеживания режима редактирования
  const [editingCommentId, setEditingCommentId] = createSignal<number>()

  // Добавляем сигнал для отслеживания контента редактора
  const [editorContent, setLocalEditorContent] = createSignal<string>('');

  const comments = createMemo(() => {
    const allReactions = Object.values(reactionEntities())
    console.log('[CommentsTree] Filtering comments:', {
      total: allReactions.length,
      shoutSlug: props.shoutSlug,
      reactions: allReactions
    })
    return allReactions.filter((r) => r.kind === ReactionKind.Comment && r.shout?.slug === props.shoutSlug)
  })

  const toggleNewOnly = () => setOnlyNew(!onlyNew())

  const sortedComments = createMemo(() => {
    const currentComments = comments()
    console.log('[CommentsTree] Sorting comments:', {
      count: currentComments.length,
      comments: currentComments
    })

    if (!currentComments.length) return []

    let sorted: Reaction[]
    if (onlyNew()) {
      sorted = newComments().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    } else {
      sorted = [...currentComments].sort((a, b) => {
        if (commentsOrder() === ReactionSort.Like) {
          return (b.stat?.rating || 0) - (a.stat?.rating || 0)
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }

    return sorted
  })

  const commentTree = createMemo(() => {
    const sorted = sortedComments()
    console.log('[CommentsTree] Building tree:', {
      sortedCount: sorted.length,
      sorted
    })

    const tree: Record<number, Reaction[]> = {}

    sorted.forEach((comment) => {
      const parentId = comment.reply_to || 0
      if (!tree[parentId]) {
        tree[parentId] = []
      }
      tree[parentId].push(comment)
    })

    console.log('[CommentsTree] Tree built:', tree)
    return tree
  })

  const { seen } = useFeed()
  const shoutLastSeen = createMemo(() => seen()[props.shoutSlug] ?? 0)
  const [isFirstLoad, setIsFirstLoad] = createSignal(true)
  const [loadMoreHidden, setLoadMoreHidden] = createSignal(false)

  const [commentsResource, { refetch }] = createResource<Reaction[], string>(
    () => props.shoutSlug,
    async (slug: string) => {
      console.log('[CommentsTree] Loading comments for slug:', slug)
      setIsLoading(true)

      try {
        const response = await loadReactionsBy({
          by: {
            shout: slug,
            kinds: [ReactionKind.Comment]
          },
          limit: COMMENTS_PER_PAGE,
          offset: 0
        })

        console.log('[CommentsTree] Response:', {
          success: !!response,
          count: response?.length,
          data: response
        })

        if (response?.length) {
          batch(() => {
            addShoutReactions(response)
            setNewComments(response)
            setLoadMoreHidden(response.length < COMMENTS_PER_PAGE)
          })
        }

        return response || []
      } catch (error) {
        console.error('[CommentsTree] Error:', error)
        return []
      } finally {
        setIsLoading(false)
      }
    }
  )

  createEffect(() => {
    const entities = reactionEntities()
    console.log('[CommentsTree] Reactions updated:', {
      total: Object.keys(entities).length,
      forCurrentShout: comments()?.length
    })
  })

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
        setNewComments(newComments)
        localStorage?.setItem(`${props.shoutSlug}`, `${currentDate}`)
      }
      setIsFirstLoad(false)
      setIsLoading(false)
    }
  })

  const [posting, setPosting] = createSignal(false)

  const handleSubmitComment = async (commentId?: number) => {
    setPosting(true)
    try {
      console.log('[CommentsTree] Submitting comment:', { 
        commentId, 
        isEditing: editingCommentId() === commentId,
        clickedReplyId: clickedReplyId()
      });
      
      // Определяем, редактируем ли мы существующий комментарий
      const isEditing = editingCommentId() === commentId;
      const isReply = !isEditing && commentId !== undefined;
      
      // Выбираем правильный ключ черновика в зависимости от режима
      let draftKey;
      if (isEditing) {
        draftKey = `draft-${props.shoutId}-comment-edit-${commentId}`;
      } else if (isReply) {
        draftKey = `draft-${props.shoutId}-comment-${commentId}`;
      } else {
        draftKey = `draft-${props.shoutId}-comment-new`;
      }
      
      console.log('[CommentsTree] Using draft key:', { draftKey });
      
      // Получаем контент напрямую из DOM, если черновик пуст
      let content = getEditorContent(draftKey);
      
      // Проверяем, есть ли контент в редакторе
      if (!content || content.trim() === '') {
        // Пробуем получить контент из DOM-элемента редактора
        const editorId = isEditing 
          ? `draft-${props.shoutId}-comment-edit-${commentId}`
          : (isReply ? `draft-${props.shoutId}-comment-${commentId}` : `draft-${props.shoutId}-comment-new`);
        
        const editorElement = document.getElementById(editorId);
        if (editorElement) {
          content = editorElement.innerHTML;
          console.log('[CommentsTree] Got content from DOM:', { content });
        }
      }
      
      console.log('[CommentsTree] Content to submit:', { content, length: content?.length });

      if (!content || content.trim() === '') {
        await showSnackbar({ type: 'error', body: t('Comment cannot be empty') });
        setPosting(false);
        return false;
      }

      // Если редактируем, то передаем id комментария, а не reply_to
      // Если отвечаем, то передаем reply_to
      const targetId = isEditing ? commentId : (isReply ? commentId : undefined);
      const success = await handleSubmitCommentValue(content, isReply ? targetId : undefined);

      if (success) {
        batch(() => {
          setEditorContent(draftKey, '');
          setClickedReplyId(undefined);
          setEditingCommentId(undefined);
        });
      }
      return success;
    } catch (error) {
      console.error('[CommentsTree] Submit error:', error);
      return false;
    } finally {
      setPosting(false);
    }
  }

  const handleSubmitCommentValue = async (content: string, replyToId?: number) => {
    console.log('[CommentsTree] Submitting comment value:', { content, replyToId });
    
    if (!content?.trim()) {
      await showSnackbar({ type: 'error', body: t('Comment cannot be empty') });
      return false;
    }

    try {
      // Sanitize content before sending
      const sanitizedContent = sanitizeHtml(content);
      console.log('[CommentsTree] Sanitized content:', { sanitizedContent });
      
      if (editingCommentId()) {
        // Редактирование существующего комментария
        const commentToEdit = comments().find(c => c.id === editingCommentId());
        if (!commentToEdit) {
          console.error('[CommentsTree] Comment to edit not found:', editingCommentId());
          return false;
        }
        
        console.log('[CommentsTree] Updating comment:', { 
          id: editingCommentId(),
          body: sanitizedContent,
          reply_to: commentToEdit.reply_to
        });
        
        const result = await updateShoutReaction({
          id: editingCommentId(),
          reaction: {
            body: sanitizedContent,
            shout: props.shoutId,
            kind: ReactionKind.Comment,
            reply_to: commentToEdit.reply_to
          }
        } as MutationUpdate_ReactionArgs);

        if (result.error) {
          await showSnackbar({ type: 'error', body: t(result.error) });
          return false;
        }
      } else if (replyToId) {
        // Создание ответа на комментарий
        console.log('[CommentsTree] Creating reply:', { 
          body: sanitizedContent,
          shout: props.shoutId,
          reply_to: replyToId
        });
        
        const newComment = await createShoutReaction({
          reaction: {
            body: sanitizedContent,
            shout: props.shoutId,
            kind: ReactionKind.Comment,
            reply_to: replyToId
          }
        });

        if (!newComment) {
          await showSnackbar({ type: 'error', body: t('Failed to create comment') });
          return false;
        }
      } else {
        // Создание нового комментария
        console.log('[CommentsTree] Creating new comment:', { 
          body: sanitizedContent,
          shout: props.shoutId
        });
        
        const newComment = await createShoutReaction({
          reaction: {
            body: sanitizedContent,
            shout: props.shoutId,
            kind: ReactionKind.Comment
          }
        });

        if (!newComment) {
          await showSnackbar({ type: 'error', body: t('Failed to create comment') });
          return false;
        }
      }

      await refetch();
      return true;
    } catch (error) {
      console.error('[CommentsTree] Submit error:', error);
      await showSnackbar({ type: 'error', body: t('Failed to save comment') });
      return false;
    }
  }

  const handleClear = () => {
    batch(() => {
      if (editingCommentId()) {
        setEditorContent(`draft-${props.shoutId}-comment-edit-${editingCommentId()}`, '')
        setEditingCommentId(undefined)
      } else {
        setEditorContent(`draft-${props.shoutId}-comment-${clickedReplyId() || 'new'}`, '')
        setClickedReplyId(undefined)
      }
    })
  }

  // Обработчик для ответа на комментарий
  const handleReply = (commentId: number) => {
    batch(() => {
      setClickedReplyId(commentId);
      setEditingCommentId(undefined);
      
      // Очищаем предыдущий черновик для нового ответа
      setEditorContent(`draft-${props.shoutId}-comment-${commentId}`, '');
    });
  }

  // Новый обработчик для редактирования комментария
  const handleEdit = (commentId: number) => {
    batch(() => {
      setEditingCommentId(commentId)
      setClickedReplyId(undefined)
      
      // Находим комментарий для редактирования
      const commentToEdit = comments().find(c => c.id === commentId);
      if (commentToEdit) {
        // Устанавливаем содержимое редактора из текста комментария
        setEditorContent(
          `draft-${props.shoutId}-comment-edit-${commentId}`, 
          commentToEdit.body || ''
        );
      }
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

  // TODO: use loadMoreComments
  const loadMoreComments = async (offset: number): Promise<LoadMoreItems | undefined> => {
    try {
      const response = await loadReactionsBy({
        by: {
          shout: props.shoutSlug,
          kinds: [ReactionKind.Comment]
        },
        limit: COMMENTS_PER_PAGE,
        offset
      })

      if (response?.length) {
        batch(() => {
          addShoutReactions(response)
          setLoadMoreHidden(response.length < COMMENTS_PER_PAGE)
        })

        return response as LoadMoreItems
      }
    } catch (error) {
      console.error('[CommentsTree] Error loading more comments:', error)
    }
    return undefined
  }

  const handleDelete = async (id: number) => {
    if (!id) return

    // Сохраняем позицию скролла перед показом модального окна
    saveScrollPosition()

    try {
      let confirmed = false

      try {
        confirmed = await showConfirm({
          confirmBody: t('Are you sure you want to delete this comment?'),
          confirmButtonLabel: t('Delete'),
          confirmButtonVariant: 'danger',
          declineButtonVariant: 'primary'
        })
      } catch (error) {
        console.error('[CommentsTree] Confirm dialog error:', error)
        // Восстанавливаем позицию скролла при ошибке
        restoreScrollPosition()
        return
      }

      // Если пользователь отменил удаление, восстанавливаем позицию скролла
      if (!confirmed) {
        restoreScrollPosition()
        return
      }

      // Показываем индикатор загрузки только если пользователь подтвердил удаление
      setIsLoading(true)

      const result = await deleteShoutReaction(id)
      const notificationType = result?.error ? 'error' : 'success'
      const notificationMessage = result?.error
        ? t('Failed to delete comment')
        : t('Comment successfully deleted')

      await showSnackbar({
        type: notificationType,
        body: notificationMessage,
        duration: 3
      })

      if (!result?.error) {
        await refetch()
      }
    } catch (error) {
      console.error('[CommentsTree] Delete error:', error)
      await showSnackbar({
        type: 'error',
        body: t('Failed to delete comment')
      })
    } finally {
      setIsLoading(false)
      // Восстанавливаем позицию скролла после всех операций
      restoreScrollPosition()
    }
  }

  const CommentBranch = (props: { parentId: number; shoutId: number }) => {
    const children = createMemo(() => commentTree()[props.parentId] || [])
    const [localContent, setLocalContent] = createSignal('');

    return (
      <Show when={children().length > 0 || clickedReplyId() === props.parentId}>
        <ul class={styles.commentsList}>
          <Show when={clickedReplyId() === props.parentId}>
            <li class={styles.replyEditor}>
              <div class={styles.editorButtonsWrapper}>
                <SimpleRichEditor
                  editorId={`draft-${props.shoutId}-comment-${clickedReplyId()}`}
                  commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                  placeholder={t('Write a reply...')}
                  onChange={(data) => {
                    console.log('[CommentsTree] Reply editor onChange:', { content: data.content });
                    setLocalContent(data.content);
                    untrack(() =>
                      setEditorContent(
                        `draft-${props.shoutId}-comment-${clickedReplyId()}`,
                        data.content
                      )
                    )
                  }}
                  bubble={false}
                />
                <Show when={localContent().trim().length > 0}>
                  <div class={styles.buttons}>
                    <Button value={t('Cancel')} variant="secondary" onClick={handleClear} />
                    <Button
                      value={posting() ? t('Saving...') : t('Save')}
                      variant="primary"
                      onClick={() => handleSubmitComment(clickedReplyId())}
                      disabled={posting()}
                    />
                  </div>
                </Show>
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
                  >
                    <CommentBranch parentId={comment.id} shoutId={props.shoutId} />
                  </CommentCard>
                </Show>
                <Show when={editingCommentId() === comment.id}>
                  <li class={styles.editingComment}>
                    <div class={styles.editorButtonsWrapper}>
                      <SimpleRichEditor
                        editorId={`draft-${props.shoutId}-comment-edit-${comment.id}`}
                        commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                        placeholder={t('Edit your comment...')}
                        onChange={(data) => {
                          console.log('[CommentsTree] Edit editor onChange:', { content: data.content });
                          setLocalContent(data.content);
                          untrack(() =>
                            setEditorContent(
                              `draft-${props.shoutId}-comment-edit-${comment.id}`,
                              data.content
                            )
                          )
                        }}
                        content={getEditorContent(`draft-${props.shoutId}-comment-edit-${comment.id}`)}
                        bubble={false}
                      />
                      <Show when={localContent().trim().length > 0}>
                        <div class={styles.buttons}>
                          <Button value={t('Cancel')} variant="secondary" onClick={handleClear} />
                          <Button
                            value={posting() ? t('Saving...') : t('Save')}
                            variant="primary"
                            onClick={() => handleSubmitComment(comment.id)}
                            disabled={posting()}
                          />
                        </div>
                      </Show>
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
            <ul class={styles.commentsList}>
              <For each={commentTree()[0] || []}>
                {(comment) => (
                  <CommentCard
                    comment={comment}
                    sortedComments={sortedComments()}
                    lastSeen={shoutLastSeen()}
                    onDelete={handleDelete}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    clickedReplyId={clickedReplyId}
                  >
                    <CommentBranch parentId={comment.id} shoutId={props.shoutId} />
                  </CommentCard>
                )}
              </For>
            </ul>
          </Show>

          <Show when={!clickedReplyId()}>
            <ShowIfAuthenticated fallback={<FallbackMessage />}>
              <div class={styles.editorButtonsWrapper}>
                <SimpleRichEditor
                  editorId={`draft-${props.shoutId}-comment-new`}
                  commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                  placeholder={t('Write a comment...')}
                  onChange={(data) => {
                    console.log('[CommentsTree] New comment editor onChange:', { content: data.content });
                    setLocalEditorContent(data.content);
                    untrack(() => setEditorContent(`draft-${props.shoutId}-comment-new`, data.content))
                  }}
                />
                <Show when={editorContent().trim().length > 0}>
                  <div class={styles.buttons}>
                    <Button value={t('Cancel')} variant="secondary" onClick={handleClear} />
                    <Button
                      value={posting() ? t('Saving...') : t('Save')}
                      variant="primary"
                      onClick={() => handleSubmitComment()}
                      disabled={posting()}
                    />
                  </div>
                </Show>
              </div>
            </ShowIfAuthenticated>
          </Show>
        </Show>
      </div>
    </ErrorBoundary>
  )
}
