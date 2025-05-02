import { For, Show, createEffect, createResource, createSignal, onCleanup, onMount } from 'solid-js'
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
import { SearchShouts } from './Views/SearchShouts'
import { SearchAuthors } from './Views/SearchAuthors'
import { SearchNav } from './Views/SearchNav'

import styles from './Styles/SearchModal.module.scss'

export const SearchModal = () => {
  const { t } = useLocalize()
  const { loadFeedSearch, searchFeed } = useFeed()
  const sentinelStyle = { height: '1px', padding: '0', margin: '0', opacity: '0' }
  const [inputValue, setInputValue] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [offset, setOffset] = createSignal<number>(0)
  const [hasMore, setHasMore] = createSignal(false)
  const [sentinelEl, setSentinelEl] = createSignal<HTMLDivElement>()
  const [currentView, setCurrentView] = createSignal('all')

  // Author search related states
  const [authorResults, setAuthorResults] = createSignal<Author[]>([])
  const [_isLoadingAuthors, setIsLoadingAuthors] = createSignal(false)

  // Fetch 6 authors for main Search Modal
  const fetchAuthorsSearch = async (query: string) => {
    if (query.length < 3) {
      setAuthorResults([])
      return []
    }

    setIsLoadingAuthors(true)

    try {

      const authorsResult = await loadAuthorsSearch(query, 6, 0)()
      setAuthorResults(authorsResult || [])
      return authorsResult || []
    } catch (error) {
      console.error('[SearchModal] Error fetching authors:', error)
      setAuthorResults([])
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
      setHasMore(false)
      setOffset(0)
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
      setHasMore(false)
      setOffset(0)
    }

    await restoreScrollPosition()
    setIsLoading(false)
  }

  // Setup intersection observer for infinite scroll
  let observer: IntersectionObserver | undefined

  const setupObserver = () => {
    if (observer) observer.disconnect()

    const modalInnerElement = document.querySelector(`.${modalStyles.modalInner}`) as Element
    if (!modalInnerElement) return

    observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && hasMore() && !isLoading()) {
          await fetchSearchResults(false)
        }
      },
      {
        root: modalInnerElement,
        rootMargin: '100px',
        threshold: 0.1
      }
    )

    const element = sentinelEl()
    if (element) {
      observer.observe(element)
    }
  }

  // Observer setup effect
  createEffect(() => {
    if (sentinelEl()) {
      // Use a small delay to ensure the modal is fully rendered
      setTimeout(setupObserver, 100)
    }
  })

  // Lifecycle hooks
  onMount(setupObserver)

  onCleanup(() => {
    debouncedSearch.cancel()
    if (observer) observer.disconnect()
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
        <SearchNav view={currentView()} setView={setCurrentView} />
      </Show>

      <Show when={!isLoading() || searchResultsList().length > 0}>
        <Show when={searchResultsList().length > 0 || authorResults().length > 0}>
          {/* Render the appropriate component based on current view */}
          <Show when={currentView() === 'all'}>
            <SearchAll 
              searchValue={inputValue()}
              isLoading={isLoading()}
              hasMore={hasMore()}
              setSentinelEl={setSentinelEl}
              sentinelStyle={sentinelStyle}
              shoutsList={searchResultsList()}
              authorsList={authorResults()}
            />
          </Show>

          <Show when={currentView() === 'shouts'}>
            <SearchShouts 
              searchValue={inputValue()}
              isLoading={isLoading()}
              hasMore={hasMore()}
              setSentinelEl={setSentinelEl}
              sentinelStyle={sentinelStyle}
              shoutsList={searchResultsList()}
            />
          </Show>

          <Show when={currentView() === 'authors'}>
            <SearchAuthors
              searchValue={inputValue()}
              isLoading={isLoading()}
              hasMore={hasMore()}
              setSentinelEl={setSentinelEl}
              sentinelStyle={sentinelStyle}
              authorsList={authorResults()}
            />
          </Show>
        </Show>

        <Show when={inputValue().trim().length >= 3 && searchResultsList().length === 0 && authorResults().length === 0 && !isLoading()}>
          <p class={styles.searchDescription} innerHTML={t("We couldn't find anything for your request")} />
        </Show>
      </Show>
    </div>
  )
}
