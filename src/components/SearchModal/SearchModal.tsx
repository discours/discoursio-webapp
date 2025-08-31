import { createEffect, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { debounce } from 'throttle-debounce'

import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import modalStyles from '~/components/_shared/Modal/Modal.module.scss'
import { useAuthors } from '~/context/authors'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { loadShoutsSearch } from '~/graphql/api/public'
import type { Author, Shout, Topic } from '~/graphql/generated/graphql'
import { dummyFilter } from '~/intl/dummyFilter'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { SearchAll } from './SearchAll'
import { SearchAuthors } from './SearchAuthors'
import styles from './SearchModal.module.scss'
import { SearchNav } from './SearchNav'
import { SearchShouts } from './SearchShouts'
import { SearchTopics } from './SearchTopic'

// 🔧 КОНСТАНТА: Размер страницы для поиска
const SEARCH_PAGE_SIZE = 20

export const SearchModal = () => {
  const { t, lang } = useLocalize()
  const { authorsEntities } = useAuthors()
  const sentinelStyle = { height: '1px', padding: '0', margin: '0', opacity: '0' }
  const [inputValue, setInputValue] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [offset, setOffset] = createSignal<number>(0)
  const [hasMore, setHasMore] = createSignal(false)

  // Use separate sentinel elements for shouts, authors and topics
  const [shoutsSentinelEl, setShoutsSentinelEl] = createSignal<HTMLDivElement>()
  const [authorsSentinelEl, setAuthorsSentinelEl] = createSignal<HTMLDivElement>()
  const [topicsSentinelEl, setTopicsSentinelEl] = createSignal<HTMLDivElement>()
  const [currentView, setCurrentView] = createSignal('all')

  // Author search related states
  const [authorsResultsList, setAuthorsResultsList] = createSignal<Author[]>([])
  const [_isLoadingAuthors, setIsLoadingAuthors] = createSignal(false)

  // Topic search related states
  const { topicsByShouts } = useTopics()
  const [topicsResultList, setTopicsResultList] = createSignal<Topic[]>([])
  const [_isLoadingTopics, setIsLoadingTopics] = createSignal(false)

  // Function to fetch Authors based on the search input
  const fetchAuthorsResults = async (query: string, resetResults = true) => {
    if (query.length < 3) {
      setAuthorsResultsList([])
      return []
    }

    setIsLoadingAuthors(true)

    try {
      // 🔧 ЛОКАЛЬНЫЙ ПОИСК: Ищем авторов по тексту без API
      const searchQuery = query.toLowerCase().trim()

      // Получаем всех авторов из контекста
      const allAuthors = Object.values(authorsEntities())

      // Текстовый поиск по имени и slug
      const filteredAuthors = allAuthors.filter((author) => {
        const name = author.name?.toLowerCase() || ''
        const slug = author.slug?.toLowerCase() || ''
        const bio = author.bio?.toLowerCase() || ''

        return name.includes(searchQuery) || slug.includes(searchQuery) || bio.includes(searchQuery)
      })

      // Сортируем по релевантности (точные совпадения в начале)
      const sortedAuthors = filteredAuthors
        .sort((a, b) => {
          const aName = a.name?.toLowerCase() || ''
          const bName = b.name?.toLowerCase() || ''
          const aSlug = a.slug?.toLowerCase() || ''
          const bSlug = b.slug?.toLowerCase() || ''

          // Точные совпадения в начале
          if (aName === searchQuery || aSlug === searchQuery) return -1
          if (bName === searchQuery || bSlug === searchQuery) return 1

          // Начинается с поискового запроса
          if (aName.startsWith(searchQuery) || aSlug.startsWith(searchQuery)) return -1
          if (bName.startsWith(searchQuery) || bSlug.startsWith(searchQuery)) return 1

          return 0
        })
        .slice(0, SEARCH_PAGE_SIZE)

      console.log('[SearchModal] Local author search:', {
        query: searchQuery,
        totalAuthors: allAuthors.length,
        filtered: filteredAuthors.length,
        result: sortedAuthors.length
      })

      // Only reset authors list if resetResults is true (new search)
      if (resetResults) {
        setAuthorsResultsList(sortedAuthors)
      }

      return sortedAuthors
    } catch (error) {
      console.error('[SearchModal] Error in local author search:', error)
      if (resetResults) {
        setAuthorsResultsList([])
      }
      return []
    } finally {
      setIsLoadingAuthors(false)
    }
  }

  // Function to fetch Shouts based on the search input
  const fetchShoutsResults = async (resetResults = false) => {
    if (inputValue().trim().length < 3) {
      return []
    }

    const currentOffset = resetResults ? 0 : offset()
    const searchQuery = inputValue().trim()

    setIsLoading(true)
    saveScrollPosition()

    if (resetResults) {
      setOffset(0)
      setshoutsResultsList([])

      // Fetch authors when resetting results
      void fetchAuthorsResults(searchQuery)
      void fetchTopicsResults(searchQuery)
    }

    try {
      // 🔧 ИСПРАВЛЕНИЕ: Используем прямой API вызов loadShoutsSearch
      const searchArgs = {
        text: searchQuery,
        options: {
          offset: currentOffset,
          limit: SEARCH_PAGE_SIZE
        }
      }

      console.log('[SearchModal] Searching shouts with:', searchArgs)
      const shoutsResult = await loadShoutsSearch(searchArgs)()

      if (shoutsResult?.length) {
        setshoutsResultsList(shoutsResult)
        setOffset(currentOffset + shoutsResult.length)
        setHasMore(shoutsResult.length >= SEARCH_PAGE_SIZE)
      } else {
        setshoutsResultsList([])
        setHasMore(false)
      }

      return shoutsResult || []
    } catch (error) {
      console.error('[SearchModal] Error searching shouts:', error)
      setshoutsResultsList([])
      setHasMore(false)
      return []
    } finally {
      setIsLoading(false)
      restoreScrollPosition()
    }
  }

  const [shoutsResultsList, { mutate: setshoutsResultsList }] = createResource<Shout[]>(fetchShoutsResults, {
    ssrLoadFrom: 'initial',
    initialValue: []
  })

  const [searchEl, setSearchEl] = createSignal<HTMLInputElement | undefined>()

  const debouncedSearch = debounce(500, () => {
    const query = inputValue().trim()
    if (query.length >= 3) {
      void fetchShoutsResults(true)
    } else {
      setshoutsResultsList([])
      setAuthorsResultsList([])
      setHasMore(false)
      setOffset(0)
    }
  })

  const handleQueryInput = async () => {
    const newValue = searchEl()?.value ?? ''
    setInputValue(newValue)

    if (newValue.trim()) {
      await debouncedSearch()
    } else {
      setshoutsResultsList([])
      setAuthorsResultsList([])
      setHasMore(false)
      setOffset(0)
    }

    // Clear author results when query is less than 3 characters
    if (newValue.trim().length < 3) {
      setAuthorsResultsList([])
    }
  }

  // Function to fetch Topics based on the search input
  const fetchTopicsResults = (query: string, resetResults = true) => {
    if (query.length < 3) {
      setTopicsResultList([])
      return []
    }

    setIsLoadingTopics(true)

    try {
      // Get all topics and filter with dummyFilter
      const allTopics = topicsByShouts()
      const filteredTopics = dummyFilter(allTopics, query, lang()) as Topic[]

      if (resetResults) {
        setTopicsResultList(filteredTopics || [])
      }

      return filteredTopics || []
    } catch (error) {
      console.error('[SearchModal] Error filtering topics:', error)
      if (resetResults) {
        setTopicsResultList([])
      }
      return []
    } finally {
      setIsLoadingTopics(false)
    }
  }

  const enterQuery = (ev: KeyboardEvent) => {
    if (ev.key !== 'Enter') return

    setIsLoading(true)
    debouncedSearch.cancel() // Cancel any pending debounced search

    const query = inputValue().trim()
    if (query.length >= 3) {
      void fetchShoutsResults(true)
    } else {
      setshoutsResultsList([])
      setAuthorsResultsList([])
      setHasMore(false)
      setOffset(0)
    }

    void restoreScrollPosition()
    setIsLoading(false)
  }

  // Setup intersection observers for infinite scroll
  let shoutsObserver: IntersectionObserver | undefined
  let authorsObserver: IntersectionObserver | undefined
  let topicsObserver: IntersectionObserver | undefined

  // Function to load more authors with pagination
  const loadMoreAuthors = async () => {
    if (inputValue().trim().length < 3 || isLoading() || !hasMore()) return

    setIsLoading(true)
    const currentQuery = inputValue().trim()
    try {
      const newAuthors = await fetchAuthorsResults(currentQuery, false) // Use local search

      if (newAuthors && newAuthors.length > 0) {
        setAuthorsResultsList([...authorsResultsList(), ...newAuthors])
        setHasMore(newAuthors.length >= SEARCH_PAGE_SIZE)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('[SearchModal] Error fetching more authors:', error)
      setHasMore(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Setup observer for shouts
  const setupShoutsObserver = () => {
    if (shoutsObserver) shoutsObserver.disconnect()
    const shoutsSentinel = shoutsSentinelEl()
    if (!shoutsSentinel) return

    const modalInnerElement = document.querySelector(`.${modalStyles.modalInner}`) as Element
    if (!modalInnerElement) return

    shoutsObserver = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && hasMore() && !isLoading()) {
          await fetchShoutsResults(false) // Load more shouts
        }
      },
      {
        root: modalInnerElement,
        rootMargin: '100px',
        threshold: 0.1
      }
    )

    shoutsObserver.observe(shoutsSentinel)
  }

  // Setup observer for authors
  const setupAuthorsObserver = () => {
    if (authorsObserver) authorsObserver.disconnect()
    const authorsSentinel = authorsSentinelEl()
    if (!authorsSentinel) return

    const modalInnerElement = document.querySelector(`.${modalStyles.modalInner}`) as Element
    if (!modalInnerElement) return

    authorsObserver = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && hasMore() && !isLoading()) {
          await loadMoreAuthors() // Load more authors
        }
      },
      {
        root: modalInnerElement,
        rootMargin: '100px',
        threshold: 0.1
      }
    )

    authorsObserver.observe(authorsSentinel)
  }

  // Setup observer for topics
  const setupTopicsObserver = () => {
    if (topicsObserver) topicsObserver.disconnect()
    const topicsSentinel = topicsSentinelEl()
    if (!topicsSentinel) return
    const modalInnerElement = document.querySelector(`.${modalStyles.modalInner}`) as Element
    if (!modalInnerElement) return
    topicsObserver = new IntersectionObserver(
      async (_entries) => {
        // For topics we don't need pagination since we're filtering client-side
        // But we could add it if needed in the future
      },
      {
        root: modalInnerElement,
        rootMargin: '100px',
        threshold: 0.1
      }
    )
    topicsObserver.observe(topicsSentinel)
  }

  // Set up observers when sentinel elements change
  createEffect(() => {
    const shoutsSentinel = shoutsSentinelEl()
    if (shoutsSentinel) {
      setupShoutsObserver()
    }
  })

  createEffect(() => {
    const authorsSentinel = authorsSentinelEl()
    if (authorsSentinel) {
      setupAuthorsObserver()
    }
  })

  createEffect(() => {
    const topicsSentinel = topicsSentinelEl()
    if (topicsSentinel) {
      setupTopicsObserver()
    }
  })

  // Cleanup observers on unmount
  onMount(() => {
    // Initial setup will happen via createEffects when sentinels are set
  })

  onCleanup(() => {
    debouncedSearch.cancel()
    if (shoutsObserver) shoutsObserver.disconnect()
    if (authorsObserver) authorsObserver.disconnect()
    if (topicsObserver) topicsObserver.disconnect()
  })

  return (
    <div class={styles.searchContainer}>
      <input
        type="search"
        placeholder={t('Site search')}
        class={styles.searchInput}
        onInput={handleQueryInput}
        onKeyDown={enterQuery}
        ref={setSearchEl}
      />

      <Button
        class={styles.searchButton}
        onClick={() => {
          const query = inputValue().trim()
          if (query.length >= 3) {
            debouncedSearch.cancel()
            void fetchShoutsResults(true)
          }
        }}
        value={isLoading() ? <div class={styles.searchLoader} /> : <Icon name="search" />}
      />

      <Show when={inputValue().trim().length < 3}>
        <p
          class={styles.searchDescription}
          innerHTML={t(
            'To find publications, art, comments, authors and topics of interest to you, just start typing your query'
          )}
        />
      </Show>

      <Show when={inputValue().trim().length >= 3}>
        <SearchNav
          view={currentView()}
          setView={(view) => {
            // When switching views, reset the offset if needed
            if (view !== currentView()) {
              setCurrentView(view)
              setHasMore(true)
            }
          }}
        />
      </Show>

      <Show when={(!isLoading() || shoutsResultsList().length > 0) && inputValue().trim().length >= 3}>
        <Show when={shoutsResultsList().length > 0 || authorsResultsList().length > 0}>
          {/* Render the appropriate component based on current view */}
          <Show when={currentView() === 'all'}>
            <SearchAll
              searchValue={inputValue()}
              isLoading={isLoading()}
              hasMore={hasMore()}
              shoutsList={shoutsResultsList()}
              authorsList={authorsResultsList()}
              topicsList={topicsResultList()}
            />
          </Show>

          <Show when={currentView() === 'posts'}>
            <SearchShouts
              searchValue={inputValue()}
              isLoading={isLoading()}
              hasMore={hasMore()}
              setSentinelEl={setShoutsSentinelEl}
              sentinelStyle={sentinelStyle}
              shoutsList={shoutsResultsList()}
            />
          </Show>

          <Show when={currentView() === 'topics'}>
            <SearchTopics
              searchValue={inputValue()}
              isLoading={isLoading()}
              hasMore={hasMore()}
              setSentinelEl={setTopicsSentinelEl}
              sentinelStyle={sentinelStyle}
              topicsList={topicsResultList()}
            />
          </Show>

          <Show when={currentView() === 'authors'}>
            <SearchAuthors
              searchValue={inputValue()}
              isLoading={isLoading()}
              hasMore={hasMore()}
              setSentinelEl={setAuthorsSentinelEl}
              sentinelStyle={sentinelStyle}
              authorsList={authorsResultsList()}
            />
          </Show>
        </Show>

        <Show
          when={
            inputValue().trim().length >= 3 &&
            shoutsResultsList().length === 0 &&
            authorsResultsList().length === 0 &&
            !isLoading()
          }
        >
          <p class={styles.searchDescription} innerHTML={t("We couldn't find anything for your request")} />
        </Show>
      </Show>
    </div>
  )
}
