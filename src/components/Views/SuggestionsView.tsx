import { createEffect, createSignal, For, Show } from 'solid-js'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { QueryLoad_Reactions_ByArgs, Reaction, ReactionKind } from '~/graphql/schema/core.gen'
import styles from '~/styles/views/SuggestionsView.module.scss'
import { Button } from '../_shared/Button'
import { SuggestionCard } from '../DiffViewer/SuggestionCard'
import { cleanupContent } from '../SimpleRichEditor/lib/sanitize'
import { EditorData } from '../SimpleRichEditor/lib/types'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'

export type Props = {
  shoutId: number
}

export const SuggestionsView = (props: Props) => {
  const { session } = useSession()
  const { t } = useLocalize()
  const { getEditorContent, setEditorContent } = useDrafts()
  const { createShoutReaction, loadReactionsBy } = useReactions()

  // Состояния
  const [suggestions, setSuggestions] = createSignal<Reaction[]>([])
  const [loading, setLoading] = createSignal(false)
  const [currentShoutId, setCurrentShoutId] = createSignal<number>()
  const [selectedRange, setSelectedRange] = createSignal<Range | null>(null)
  const [replyTo, setReplyTo] = createSignal<number | null>(null)

  /**
   * Загружает реакции для текущего shout
   * Фильтрует только корневые реакции типов ASK и PROPOSE
   */
  const loadReactions = async (shoutId: number) => {
    setLoading(true)
    try {
      const reactions = await loadReactionsBy({
        by: {
          shout_id: shoutId,
          reply_to: null,
          kinds: [ReactionKind.Ask, ReactionKind.Propose]
        }
      } as QueryLoad_Reactions_ByArgs)
      setSuggestions(reactions || [])
    } catch (error) {
      console.error('Failed to load reactions:', error)
    } finally {
      setLoading(false)
    }
  }

  // Загрузка реакций при монтировании
  createEffect(() => {
    if (props.shoutId) {
      void loadReactions(props.shoutId)
    }
  })

  /**
   * Обработчик выделения текста
   * Сохраняет выделенный диапазон и ID шаута
   */
  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      setSelectedRange(null)
      return
    }

    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer.parentElement
    const shoutId = container?.closest('[data-shout-id]')?.getAttribute('data-shout-id')

    if (shoutId) {
      setCurrentShoutId(Number.parseInt(shoutId))
      setSelectedRange(range)
    }
  }

  // Подписка на событие выделения текста
  createEffect(() => {
    document.addEventListener('mouseup', handleTextSelection)
    return () => document.removeEventListener('mouseup', handleTextSelection)
  })

  /**
   * Создает новую реакцию
   * @param type - Тип реакции (предложение или вопрос)
   * @param replyToId - ID реакции, на которую отвечаем
   */
  const createSuggestion = async (type: ReactionKind, replyToId?: number) => {
    const shoutId = currentShoutId()
    if (!session || !shoutId) return

    const content = replyToId
      ? getEditorContent(`draft-${shoutId}-comment-${replyToId}`)
      : selectedRange()?.toString() || ''

    if (!content) return

    try {
      await createShoutReaction({
        reaction: {
          kind: type,
          shout: shoutId,
          body: cleanupContent(content),
          reply_to: replyToId
        }
      })

      // Очищаем состояния
      setSelectedRange(null)
      setReplyTo(null)
      if (replyToId) {
        setEditorContent(`draft-${shoutId}-comment-${replyToId}`, '')
      }

      // Перезагружаем реакции
      await loadReactions(shoutId)
    } catch (error) {
      console.error('Failed to create reaction:', error)
    }
  }

  /**
   * Обработчик ответа на комментарий
   */
  const handleReply = (commentId: number) => {
    if (!session) return
    setReplyTo(commentId)
  }

  /**
   * Обработчик изменения содержимого редактора
   */
  const handleEditorChange = (data: EditorData) => {
    const shoutId = currentShoutId()
    const replyId = replyTo()
    if (!shoutId || !replyId) return

    setEditorContent(`draft-${shoutId}-comment-${replyId}`, data.content)
  }

  return (
    <div class={styles.container}>
      <Show when={!loading()}>
        <div class={styles.list}>
          <For each={suggestions()}>
            {(suggestion: Reaction) => (
              <div class={styles.item}>
                <SuggestionCard reaction={suggestion} onReply={handleReply} />
                <Show when={replyTo() === suggestion.id}>
                  <div class={styles.replyEditor}>
                    <SimpleRichEditor
                      editorId={`draft-${currentShoutId()}-comment-${suggestion.id}`}
                      commands={['bold', 'italic', 'link', 'image', 'blockquote']}
                      placeholder={t('Write a reply...')}
                      onChange={handleEditorChange}
                      content={getEditorContent(`draft-${currentShoutId()}-comment-${suggestion.id}`)}
                      toolbar="bottom"
                    />
                    <div class={styles.replyButtons}>
                      <Button value={t('Cancel')} variant="secondary" onClick={() => setReplyTo(null)} />
                      <Button
                        value={t('Reply')}
                        variant="primary"
                        onClick={() => createSuggestion(ReactionKind.Ask, suggestion.id)}
                      />
                    </div>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={selectedRange()}>
        <div class={styles.reactionDialog}>
          <div class={styles.selectedText}>{selectedRange()?.toString()}</div>
          <div class={styles.dialogButtons}>
            <button class={styles.proposeButton} onClick={() => createSuggestion(ReactionKind.Propose)}>
              {t('Propose an edit')}
            </button>
            <button class={styles.askButton} onClick={() => createSuggestion(ReactionKind.Ask)}>
              {t('Ask a question')}
            </button>
            <button class={styles.cancelButton} onClick={() => setSelectedRange(null)}>
              {t('Cancel')}
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}

export default SuggestionsView
