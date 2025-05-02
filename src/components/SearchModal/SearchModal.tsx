import { Show, createEffect, createResource, createSignal, onCleanup, onMount } from 'solid-js'
import { debounce } from 'throttle-debounce'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import modalStyles from '~/components/_shared/Modal/Modal.module.scss'
import { FEED_PAGE_SIZE, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { loadAuthorsSearch } from '~/graphql/api/public'
import type { Author, Shout } from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { SearchAll } from './Views/SearchAll'
import { SearchAuthors } from './Views/SearchAuthors'
import { SearchNav } from './Views/SearchNav'
import { SearchShouts } from './Views/SearchShouts'

import styles from './Styles/SearchModal.module.scss'

export const SearchModal = () => {
  const { t } = useLocalize()
  const { loadFeedSearch, searchFeed } = useFeed()
  const sentinelStyle = { height: '1px', padding: '0', margin: '0', opacity: '0' }
  const [inputValue, setInputValue] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [offset, setOffset] = createSignal<number>(0)
  const [hasMore, setHasMore] = createSignal(false)

  // Use separate sentinel elements for shouts and authors
  const [shoutsSentinelEl, setShoutsSentinelEl] = createSignal<HTMLDivElement>()
  const [authorsSentinelEl, setAuthorsSentinelEl] = createSignal<HTMLDivElement>()
  const [currentView, setCurrentView] = createSignal('all')

  // Author search related states
  const [authorResults, setAuthorResults] = createSignal<Author[]>([])
  const [_isLoadingAuthors, setIsLoadingAuthors] = createSignal(false)

  // Fetch FEED_PAGE_SIZE authors but only show 6 in SearchAll
  const fetchAuthorsSearch = async (query: string, resetResults = true) => {
    if (query.length < 3) {
      setAuthorResults([])
      return []
    }

    setIsLoadingAuthors(true)

    try {
      const authorsResult = await loadAuthorsSearch(query, FEED_PAGE_SIZE, 0)()

      // Only reset authors list if resetResults is true (new search)
      if (resetResults) {
        setAuthorResults(authorsResult || [])
      }

      return authorsResult || []
    } catch (error) {
      console.error('[SearchModal] Error fetching authors:', error)
      if (resetResults) {
        setAuthorResults([])
      }
      return []
    } finally {
      setIsLoadingAuthors(false)
    }
  }

  const fetchSearchResults = async (resetResults = false) => {
    if (inputValue().trim().length < 3) {
      return []
    }

    const currentOffset = resetResults ? 0 : offset()
    const searchQuery = inputValue().trim()

    setIsLoading(true)
    saveScrollPosition()

    if (resetResults) {
      setOffset(0)
      setSearchResultsList([])

      // Fetch authors when resetting results
      fetchAuthorsSearch(searchQuery)
    }

    await loadFeedSearch(searchQuery, {
      offset: currentOffset,
      limit: FEED_PAGE_SIZE
    })

    const { hasMore: more, shouts: newShouts } = searchFeed()

    setIsLoading(false)
    setOffset(currentOffset + (newShouts?.length || 0))
    setHasMore(more)

    if (newShouts?.length) {
      setSearchResultsList(newShouts)
    }

    restoreScrollPosition()
    return resetResults ? newShouts || [] : []
  }

  const [searchResultsList, { mutate: setSearchResultsList }] = createResource<Shout[]>(
    fetchSearchResults,
    { ssrLoadFrom: 'initial', initialValue: [] }
  )

  const [searchEl, setSearchEl] = createSignal<HTMLInputElement | undefined>()

  const debouncedSearch = debounce(500, () => {
    const query = inputValue().trim()
    if (query.length >= 3) {
      fetchSearchResults(true)
    } else {
      setSearchResultsList([])
      setAuthorResults([])
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
      setSearchResultsList([])
      setAuthorResults([])
      setHasMore(false)
      setOffset(0)
    }

    // Clear author results when query is less than 3 characters
    if (newValue.trim().length < 3) {
      setAuthorResults([])
    }
  }

  const enterQuery = async (ev: KeyboardEvent) => {
    if (ev.key !== 'Enter') return

    setIsLoading(true)
    debouncedSearch.cancel() // Cancel any pending debounced search

    const query = inputValue().trim()
    if (query.length >= 3) {
      await fetchSearchResults(true)
    } else {
      setSearchResultsList([])
      setAuthorResults([])
      setHasMore(false)
      setOffset(0)
    }

    await restoreScrollPosition()
    setIsLoading(false)
  }

  // Setup intersection observers for infinite scroll
  let shoutsObserver: IntersectionObserver | undefined
  let authorsObserver: IntersectionObserver | undefined

  // Function to load more authors with pagination
  const loadMoreAuthors = async () => {
    if (inputValue().trim().length < 3 || isLoading() || !hasMore()) return

    setIsLoading(true)
    const currentQuery = inputValue().trim()
    try {
      const authorOffset = authorResults().length
      const newAuthors = await loadAuthorsSearch(currentQuery, FEED_PAGE_SIZE, authorOffset)()

      if (newAuthors && newAuthors.length > 0) {
        setAuthorResults([...authorResults(), ...newAuthors])
        setHasMore(newAuthors.length >= FEED_PAGE_SIZE)
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
          await fetchSearchResults(false) // Load more shouts
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

  // Cleanup observers on unmount
  onMount(() => {
    // Initial setup will happen via createEffects when sentinels are set
  })

  onCleanup(() => {
    debouncedSearch.cancel()
    if (shoutsObserver) shoutsObserver.disconnect()
    if (authorsObserver) authorsObserver.disconnect()
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
            fetchSearchResults(true)
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

      <Show when={(!isLoading() || searchResultsList().length > 0) && inputValue().trim().length >= 3}>
        <Show when={searchResultsList().length > 0 || authorResults().length > 0}>
          {/* Render the appropriate component based on current view */}
          <Show when={currentView() === 'all'}>
            <SearchAll
              searchValue={inputValue()}
              isLoading={isLoading()}
              hasMore={hasMore()}
              shoutsList={searchResultsList()}
              authorsList={authorResults()}
            />
          </Show>

          <Show when={currentView() === 'shouts'}>
            <SearchShouts
              searchValue={inputValue()}
              isLoading={isLoading()}
              hasMore={hasMore()}
              setSentinelEl={setShoutsSentinelEl}
              sentinelStyle={sentinelStyle}
              shoutsList={searchResultsList()}
            />
          </Show>

          <Show when={currentView() === 'authors'}>
            <SearchAuthors
              searchValue={inputValue()}
              isLoading={isLoading()}
              hasMore={hasMore()}
              setSentinelEl={setAuthorsSentinelEl}
              sentinelStyle={sentinelStyle}
              authorsList={authorResults()}
            />
          </Show>
        </Show>

        <Show
          when={
            inputValue().trim().length >= 3 &&
            searchResultsList().length === 0 &&
            authorResults().length === 0 &&
            !isLoading()
          }
        >
          <p class={styles.searchDescription} innerHTML={t("We couldn't find anything for your request")} />
        </Show>
      </Show>
    </div>
  )
}
