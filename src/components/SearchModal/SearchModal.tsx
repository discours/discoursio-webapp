import { For, Show, createResource, createSignal, onCleanup } from 'solid-js'
import { debounce } from 'throttle-debounce'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
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
  list.sort(byScore as (a: Shout, b: Shout) => number).map((article, index) => ({
    ...article,
    id: index,
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
  const [isLoadMoreButtonVisible, setIsLoadMoreButtonVisible] = createSignal(false)
  const [inputValue, setInputValue] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [offset, setOffset] = createSignal<number>(0)

  const fetchSearchResults = async () => {
    if (inputValue().trim().length < 3) {
      return []
    }
    
    console.debug('[SearchModal] Searching for:', inputValue())
    setIsLoading(true)
    saveScrollPosition()
    
    await loadFeedSearch(inputValue().trim(), {
      offset: offset(),
      limit: FEED_PAGE_SIZE
    })
    
    const { hasMore, shouts: newShouts } = searchFeed()
    console.debug('[SearchModal] Search API returned:', { 
      totalResults: newShouts?.length || 0, 
      hasMore 
    })
    
    // Only increment offset if we got new results
    if (newShouts && newShouts.length > 0) {
      setOffset((current) => current + newShouts.length)
    }
    setIsLoadMoreButtonVisible(hasMore)
    setIsLoading(false)
    restoreScrollPosition()
    
    return newShouts || []
  }
  
  const [searchResultsList, { refetch: loadSearchResults, mutate: setSearchResultsList }] = createResource<
    Shout[]
  >(fetchSearchResults, { ssrLoadFrom: 'initial', initialValue: [] })

  const [searchEl, setSearchEl] = createSignal<HTMLInputElement | undefined>()
  
  // Properly debounced search function - waits 500ms after typing stops before searching
  const debouncedSearch = debounce(500, () => {
    const query = inputValue().trim()
    if (query.length >= 3) {
      console.debug('[SearchModal] debouncedSearch triggering search for:', query)
      setOffset(0)
      loadSearchResults()
    } else {
      console.debug('[SearchModal] Query too short, clearing results:', query)
      setSearchResultsList([])
      setIsLoadMoreButtonVisible(false)
    }
  })

  const handleQueryInput = () => {
    const newValue = searchEl()?.value ?? ''
    console.debug('[SearchModal] handleQueryInput called with value:', newValue)
    setInputValue(newValue)
    
    // Only debounce search if query is not empty
    if (newValue.trim()) {
      debouncedSearch()
    } else {
      // Clear results immediately if query is empty
      setSearchResultsList([])
      setIsLoadMoreButtonVisible(false)
    }
  }

  const enterQuery = (ev: KeyboardEvent) => {
    console.debug('[SearchModal] enterQuery called with key:', ev.key)
    
    if (ev.key === 'Enter') {
      // Cancel any pending debounced search
      debouncedSearch.cancel()
      
      const query = inputValue().trim()
      if (query.length >= 3) {
        console.debug('[SearchModal] Enter key pressed, triggering immediate search')
        setOffset(0)
        loadSearchResults()
      } else {
        console.warn('[SearchModal] Query too short for search:', query)
        setSearchResultsList([])
        setIsLoadMoreButtonVisible(false)
      }
    }
  }

  // Cleanup the debounce timer when the component unmounts
  onCleanup(() => {
    debouncedSearch.cancel()
    console.debug('[SearchModal] cleanup debouncing search')
  })

  const loadMoreResults = async () => {
    console.debug('[SearchModal] Loading more results')
    
    // If we're already at the end or loading, don't try to load more
    if (!isLoadMoreButtonVisible() || isLoading()) {
      return []
    }
    
    const result = await fetchSearchResults()
    
    // If we got no results, ensure we don't keep trying
    if (!result || result.length === 0) {
      setIsLoadMoreButtonVisible(false)
    }
    
    return result as LoadMoreItems
  }

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
          const query = inputValue().trim();
          if (query.length >= 3) {
            debouncedSearch.cancel(); // Cancel any pending debounced search
            setOffset(0)
            loadSearchResults();
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

      <Show when={!isLoading()}>
        <Show when={searchResultsList()?.length > 0}>
          <LoadMoreWrapper
            loadFunction={loadMoreResults}
            pageSize={FEED_PAGE_SIZE}
            hidden={!isLoadMoreButtonVisible()}
          >
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
          </LoadMoreWrapper>
        </Show>

        <Show when={inputValue().trim().length >= 3 && searchResultsList()?.length === 0}>
          <p class={styles.searchDescription} innerHTML={t("We couldn't find anything for your request")} />
        </Show>
      </Show>
    </div>
  )
}