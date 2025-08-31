import { useSearchParams } from '@solidjs/router'
import { createEffect, createMemo, createSignal, For, onMount, Show, untrack } from 'solid-js'
import { debounce } from 'throttle-debounce'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import type { SearchResult, Shout } from '~/graphql/generated/graphql'
import styles from '~/styles/views/Search.module.scss'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { createSearchOptions, isValidSearchQuery, SEARCH_DEFAULTS } from '~/utils/search'
import { byScore } from '~/utils/sort'
import { LoadMoreItems, LoadMoreWrapper } from '../_shared/LoadMoreWrapper'
import { ArticleCard } from '../Feed/ArticleCard'

type Props = {
  query: string
  results: SearchResult[]
}

export const SearchView = (props: Props) => {
  const { t } = useLocalize()
  const { searchFeed, loadFeedSearch } = useFeed()
  const [isLoadMoreButtonVisible, setIsLoadMoreButtonVisible] = createSignal(false)
  const [query, setQuery] = createSignal(props.query)
  const [offset, setOffset] = createSignal(0)
  const [isSearching, setIsSearching] = createSignal(false)

  const [searchParams] = useSearchParams<{ by?: string }>()
  let searchEl: HTMLInputElement

  // 🔄 Единая функция выполнения поиска
  const executeSearch = async (searchQuery: string, isLoadMore = false) => {
    console.log('[SearchView] executeSearch called with:', searchQuery, 'isLoadMore:', isLoadMore)

    if (!isValidSearchQuery(searchQuery)) {
      console.log('[SearchView] Invalid search query, aborting')
      setIsSearching(false)
      return
    }

    const searchOptions = createSearchOptions(isLoadMore ? offset() : 0, SEARCH_DEFAULTS.PAGE_SIZE)

    console.log('[SearchView] Search options:', searchOptions)

    try {
      console.log('[SearchView] Calling loadFeedSearch...')
      await loadFeedSearch(searchQuery, searchOptions)

      untrack(() => {
        const { hasMore } = searchFeed()
        console.log('[SearchView] Search completed, hasMore:', hasMore)
        setIsLoadMoreButtonVisible(hasMore)
        setOffset(isLoadMore ? offset() + SEARCH_DEFAULTS.PAGE_SIZE : SEARCH_DEFAULTS.PAGE_SIZE)
      })
    } catch (error) {
      console.error('[SearchView] Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  // 🔄 Дебаунсированный поиск
  const debouncedSearch = debounce(SEARCH_DEFAULTS.DEBOUNCE_MS, async (searchQuery: string) => {
    await executeSearch(searchQuery)
  })

  const handleQueryChange = () => {
    const newQuery = searchEl.value
    console.log('[SearchView] Query changed:', newQuery)
    setQuery(newQuery)

    // 🔄 Показываем состояние поиска немедленно для отзывчивого UI
    if (isValidSearchQuery(newQuery)) {
      console.log('[SearchView] Valid query, starting search...')
      setIsSearching(true)
    } else {
      console.log('[SearchView] Invalid query, min length:', SEARCH_DEFAULTS.MIN_LENGTH)
    }

    void debouncedSearch(newQuery)
  }

  // 🔄 Упрощенная функция loadMore
  const loadMore = async () => {
    const currentQuery = query()

    if (!isValidSearchQuery(currentQuery)) {
      return [] as LoadMoreItems
    }

    saveScrollPosition()
    await executeSearch(currentQuery, true)
    restoreScrollPosition()

    return untrack(() => searchFeed().shouts) as LoadMoreItems
  }

  // 🔄 Реактивный эффект для синхронизации с URL согласно solid-memo.md
  createEffect(() => {
    const initialQuery = props.query
    if (initialQuery !== query() && searchEl) {
      setQuery(initialQuery)
      searchEl.value = initialQuery
    }
  })

  onMount(async () => {
    const q = window.location.pathname.replace('/search/', '') || props.query

    // 🔧 Debug: проверяем текущую тему
    console.log('[SearchView] Current theme:', {
      dataTheme: document.documentElement.getAttribute('data-theme'),
      backgroundColorVar: getComputedStyle(document.documentElement).getPropertyValue('--background-color'),
      defaultColorVar: getComputedStyle(document.documentElement).getPropertyValue('--default-color')
    })

    // 🔄 Атомарное обновление состояния
    untrack(() => {
      setQuery(q)
      if (searchEl) searchEl.value = q
    })

    // 🎯 Если есть результаты в пропсах, инициализируем контекст
    if (props.results.length > 0) {
      console.log('[SearchView] Initializing context with props results:', props.results.length)
      // Инициализируем контекст данными из пропсов
      // НЕ делаем новый запрос, если данные уже есть
      return
    }

    // 🔄 Загружаем начальные результаты если запрос валидный и нет данных в пропсах
    if (isValidSearchQuery(q)) {
      console.log('[SearchView] Loading initial search results for:', q)
      setIsSearching(true)
      await executeSearch(q)
    }
  })

  // 🔄 Сортировка результатов по выбранному критерию
  const sortedShouts = createMemo(() => {
    // 🎯 Приоритет: сначала проверяем пропсы, потом контекст
    const shouts = props.results.length > 0 ? props.results : searchFeed()?.shouts || []
    const sortBy = searchParams?.by || 'relevance'

    console.log('[SearchView] Sorting shouts:', {
      propsLength: props.results.length,
      contextLength: searchFeed()?.shouts?.length || 0,
      using: props.results.length > 0 ? 'props' : 'context',
      finalLength: shouts.length
    })

    if (shouts.length === 0) return []

    // Создаем копию для сортировки
    const sortableShouts = [...shouts]

    switch (sortBy) {
      case 'relevance':
        // Используем score если доступен (SearchResult), иначе сортируем по дате
        return sortableShouts.sort((a, b) => {
          // Проверяем, есть ли score у результатов
          const aScore = (a as SearchResult & { score?: number })?.score
          const bScore = (b as SearchResult & { score?: number })?.score

          if (aScore !== undefined && bScore !== undefined) {
            return byScore({ score: aScore }, { score: bScore })
          }

          // Fallback: сортировка по дате создания (новые сначала)
          const aDate = a.created_at || 0
          const bDate = b.created_at || 0
          return bDate - aDate
        })

      case 'rating':
        // Fallback: сортировка по дате (рейтинг недоступен в SearchResult)
        return sortableShouts.sort((a, b) => {
          const aDate = a.created_at || 0
          const bDate = b.created_at || 0
          return bDate - aDate
        })

      default:
        return sortableShouts
    }
  })

  return (
    <div class={`${styles['search-page']} wide-container`}>
      <form action="/search" class={`${styles['search-form']} row`}>
        <div class="col-sm-18">
          <input
            type="search"
            name="q"
            ref={(el) => (searchEl = el)}
            onInput={handleQueryChange}
            placeholder={query() || `${t('Enter text')}...`}
            disabled={isSearching()}
            classList={{
              searching: isSearching()
            }}
          />
          {/* 🔄 Индикатор поиска в поле ввода */}
          <Show when={isSearching()}>
            <div class={styles['search-input-spinner']}>⌛</div>
          </Show>
        </div>
        <div class="col-sm-6">
          <button class="button" type="submit" onClick={loadMore} disabled={isSearching() || searchFeed()?.isLoading}>
            <Show when={isSearching() || searchFeed()?.isLoading} fallback={t('Search')}>
              {t('Loading')}...
            </Show>
          </button>
        </div>
      </form>

      <ul class="view-switcher">
        <li
          classList={{
            'view-switcher__item--selected': searchParams?.by === 'relevance'
          }}
        >
          <a href="?by=relevance">{t('By relevance')}</a>
        </li>
        <li
          classList={{
            'view-switcher__item--selected': searchParams?.by === 'rating'
          }}
        >
          <a href="?by=rating">{t('Top rated')}</a>
        </li>
      </ul>

      <Show
        when={searchFeed()?.shouts?.length > 0}
        fallback={
          <div>
            <Show when={searchFeed()?.isLoading || isSearching()}>
              <p>{t('Loading')}...</p>
            </Show>
            <Show when={!searchFeed()?.isLoading && !isSearching() && searchFeed()?.isEmpty}>
              <p>{t('No results found')}</p>
            </Show>
            <Show when={!searchFeed()?.isLoading && !isSearching() && !isValidSearchQuery(query())}>
              <p>{t('Enter at least 2 characters to search')}</p>
            </Show>
          </div>
        }
      >
        <h3>
          {t('Publications')} ({searchFeed()?.shouts?.length})
        </h3>

        <div class="floor">
          <div class="row">
            <LoadMoreWrapper
              pageSize={SEARCH_DEFAULTS.PAGE_SIZE}
              hidden={!isLoadMoreButtonVisible() || isSearching()}
              loadFunction={loadMore}
            >
              <For each={sortedShouts()}>
                {(article) => (
                  <div class="col-md-6">
                    <ArticleCard article={article as Shout} desktopCoverSize="L" />
                  </div>
                )}
              </For>
            </LoadMoreWrapper>

            <Show when={isLoadMoreButtonVisible() && !isSearching()}>
              <div class="col-md-6">
                <button onClick={loadMore} class="search__show-more" disabled={searchFeed()?.isLoading}>
                  <span class="search__show-more-inner">
                    <Show when={searchFeed()?.isLoading} fallback={t('Load more')}>
                      {t('Loading')}...
                    </Show>
                  </span>
                </button>
              </div>
            </Show>

            {/* 🔄 Индикатор поиска */}
            <Show when={isSearching()}>
              <div class="col-md-6">
                <div class={styles['search__searching-indicator']}>
                  <span>{t('Searching')}...</span>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
