import { For, Show, createEffect, createSignal } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSnackbar } from '~/context/ui'
import { Reaction, ReactionBy, ReactionKind } from '~/graphql/schema/core.gen'
import { Loading } from '~/components/_shared/Loading'
import { SuggestionCard } from '../DiffViewer/SuggestionCard'

import styles from '~/styles/views/SuggestionsView.module.scss'


/**
 * Интерфейс пропсов компонента SuggestionsView
 * @interface Props
 * @property {Reaction[]} suggestions - Массив предложений к статье
 * @property {number} totalCount - Общее количество предложений
 */
interface Props {
  suggestions?: Reaction[]
  totalCount?: number
}

/**
 * Компонент отображения предложенных статей
 * Показывает список статей, предложенных для публикации,
 * с возможностью модерации и взаимодействия
 *
 * @component
 * @example
 * <SuggestionsView suggestions={articles} totalCount={10} />
 */
export const SuggestionsView = (props: Props) => {
  const { t } = useLocalize()
  const { showSnackbar } = useSnackbar()
  const { loadReactionsBy } = useReactions()

  // Локальное состояние
  const [isLoading, setIsLoading] = createSignal(false)
  const [suggestions, setSuggestions] = createSignal<Reaction[]>(props.suggestions || [])
  const [currentPage, setCurrentPage] = createSignal(1)
  const [hasMore, setHasMore] = createSignal(true)

  // Количество статей на странице
  const ITEMS_PER_PAGE = 10

  /**
   * Загружает реакции для статей
   * @param {Shout[]} articles - Массив статей для загрузки реакций
   */
  const loadReactions = async (rrr: Reaction[]) => {
    if (!rrr.length) return

    setIsLoading(true)
    try {
      for (const r of rrr) {
        await loadReactionsBy({
          by: {
              shout_id: r.shout,
              kinds: [
                  ReactionKind.Accept,
                  ReactionKind.Reject,
                  ReactionKind.Ask,
                  ReactionKind.Propose
              ]
          } as unknown as ReactionBy
        })
      }
    } catch (error) {
      console.error('[SuggestionsView] Error loading reactions:', error)
      showSnackbar({ type: 'error', body: t('Failed to load reactions') })
    } finally {
      setIsLoading(false)
    }
  }
  /**
   * Загружает следующую страницу предложенных статей
   */
  const loadMore = async () => {
    if (isLoading() || !hasMore()) return

    setIsLoading(true)
    try {
      // TODO: Реализовать загрузку следующей страницы через API
      const nextPage = currentPage() + 1
      setCurrentPage(nextPage)

      // Проверяем, есть ли еще статьи для загрузки
      if (props.totalCount && suggestions().length >= props.totalCount) {
        setHasMore(false)
      }
    } catch (error) {
      console.error('[SuggestionsView] Error loading more suggestions:', error)
      showSnackbar({ type: 'error', body: t('Failed to load more articles') })
    } finally {
      setIsLoading(false)
    }
  }

  // Загружаем реакции при монтировании компонента
  createEffect(() => {
    if (suggestions().length > 0) {
      loadReactions(suggestions())
    }
  })

  return (
    <div class={styles.container}>
    <Show when={!isLoading() || suggestions().length > 0} fallback={<Loading />}>
        <div class={styles.list}>
        <For each={suggestions()}>
            {(r: Reaction) => (
            <div class={styles.item}>
                <SuggestionCard reaction={r} />
            </div>
            )}
        </For>
        </div>

        <Show when={hasMore() && !isLoading()}>
        <div class={styles.loadMore}>
            <button onClick={loadMore} class="button button-primary">
            {t('Load more')}
            </button>
        </div>
        </Show>
    </Show>
    </div>
  )
}

export default SuggestionsView