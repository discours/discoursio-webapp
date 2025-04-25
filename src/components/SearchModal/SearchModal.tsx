import { For, Show, createEffect, createResource, createSignal, onCleanup, onMount } from 'solid-js'
import { debounce } from 'throttle-debounce'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import modalStyles from '~/components/_shared/Modal/Modal.module.scss'
import { FEED_PAGE_SIZE, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import type { Shout } from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { byScore } from '~/utils/sort'
import { SearchResultItem } from './SearchResultItem'

import styles from './SearchModal.module.scss'

// @@TODO handle empty article options after backend support (subtitle, cover, etc.)
// @@TODO implement FILTERS & TOPICS

const getSearchCoincidences = ({ str, intersection }: { str: string; intersection: string }) =>
  `<span>${str.replaceAll(
    new RegExp(intersection, 'gi'),
    (casePreservedMatch) => `<span class="blackModeIntersection">${casePreservedMatch}</span>`
  )}</span>`

const prepareSearchResults = (list: Shout[], searchValue: string) =>
  list.map((article) => ({
    ...article,
    title: article.title
      ? getSearchCoincidences({
          str: article.title,
          intersection: searchValue
        })
      : '',
    subtitle: article.subtitle
      ? getSearchCoincidences({
          str: article.subtitle,
          intersection: searchValue
        })
      : ''
  }))

export const SearchModal = () => {
  const { t } = useLocalize()
  const { loadFeedSearch, searchFeed } = useFeed()
  const sentinelStyle = { height: '1px', padding: '0', margin: '0', opacity: '0' }
  const [inputValue, setInputValue] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [offset, setOffset] = createSignal<number>(0)
  const [hasMore, setHasMore] = createSignal(false)
  const [sentinelEl, setSentinelEl] = createSignal<HTMLDivElement>()

  const fetchSearchResults = async (resetResults = false) => {
    if (inputValue().trim().length < 3) {
      return []
    }

    const currentOffset = resetResults ? 0 : offset()

    setIsLoading(true)
    saveScrollPosition()

    if (resetResults) {
      setOffset(0)
      setSearchResultsList([])
    }

    await loadFeedSearch(inputValue().trim(), {
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
            debouncedSearch.cancel() // Cancel any pending debounced search
            fetchSearchResults(true)
          }
        }}
        value={isLoading() ? <div class={styles.searchLoader} /> : <Icon name="search" />}
      />

      <p
        class={styles.searchDescription}
        innerHTML={t(
          'To find publications, art, comments, authors and topics of interest to you, just start typing your query'
        )}
      />

      <Show when={!isLoading() || searchResultsList().length > 0}>
        <Show when={searchResultsList().length > 0}>
          <div class={styles.searchResults}>
            <For each={prepareSearchResults(searchResultsList(), inputValue())}>
              {(article: Shout) => (
                <div>
                  <SearchResultItem
                    article={article}
                    settings={{
                      isFloorImportant: true,
                      isSingle: true,
                      nodate: true
                    }}
                  />
                </div>
              )}
            </For>

            {/* Sentinel element for infinite scroll */}
            <div ref={setSentinelEl} data-testid="search-sentinel" style={sentinelStyle}>
              <Show when={isLoading() && hasMore()}>
                <div class={styles.searchLoader} />
              </Show>
            </div>

            {/* Loading indicator at the bottom when loading more */}
            <Show when={isLoading() && searchResultsList().length > 0}>
              <div class={styles.searchLoader} />
            </Show>
          </div>
        </Show>

        <Show when={inputValue().trim().length >= 3 && searchResultsList().length === 0 && !isLoading()}>
          <p class={styles.searchDescription} innerHTML={t("We couldn't find anything for your request")} />
        </Show>
      </Show>

      {/* Show initial loading state when there are no results yet */}
      <Show when={isLoading() && searchResultsList().length === 0}>
        <div class={styles.loadingContainer}>
          <div class={styles.searchLoader} />
        </div>
      </Show>
    </div>
  )
}
