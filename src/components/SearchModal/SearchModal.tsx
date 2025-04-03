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
  const [inputValue, setInputValue] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [searchQuery, setSearchQuery] = createSignal<string | null>(null)
  const [allResults, setAllResults] = createSignal<Shout[]>([])
  const [displayedResults, setDisplayedResults] = createSignal<Shout[]>([])
  const [displayedCount, setDisplayedCount] = createSignal(0)
  const [hasMoreToDisplay, setHasMoreToDisplay] = createSignal(false)
  
  // Create a resource that depends on the searchQuery - this will only execute
  // when searchQuery changes and is not null
  const [_, { refetch }] = createResource(
    searchQuery, 
    async (query: string) => {
      if (!query || query.length < 3) {
        return null
      }
      
      console.debug('[SearchModal] Searching for:', query)
      setIsLoading(true)
      saveScrollPosition()
      
      // Request a larger batch size (100 items) to reduce API calls
      await loadFeedSearch(query, {
        offset: 0,
        limit: 100 // Request more items at once
      })
      
      const { hasMore, shouts } = searchFeed()
      console.debug('[SearchModal] Search API returned:', { 
        totalResults: shouts?.length || 0, 
        hasMore 
      })
      
      // Store all results to allow pagination without additional API calls
      setAllResults(shouts || [])
      
      // Only display the first page initially
      const initialItems = (shouts || []).slice(0, FEED_PAGE_SIZE)
      setDisplayedResults(initialItems)
      setDisplayedCount(initialItems.length)
      setHasMoreToDisplay((shouts?.length || 0) > FEED_PAGE_SIZE)
      
      setIsLoading(false)
      restoreScrollPosition()
      return query;
    },
    { ssrLoadFrom: 'initial', initialValue: null }
  )

  const [searchEl, setSearchEl] = createSignal<HTMLInputElement | undefined>()
  
  // Properly debounced search function - waits 500ms after typing stops before searching
  const debouncedSearch = debounce(500, () => {
    const query = inputValue().trim()
    if (query.length >= 3) {
      console.debug('[SearchModal] debouncedSearch triggering search for:', query)
      // Reset pagination state
      setDisplayedCount(0)
      setSearchQuery(query)
    } else {
      console.debug('[SearchModal] Query too short, clearing results:', query)
      setAllResults([])
      setDisplayedResults([])
      setDisplayedCount(0)
      setHasMoreToDisplay(false)
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
      setAllResults([])
      setDisplayedResults([])
      setDisplayedCount(0)
      setHasMoreToDisplay(false)
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
        // Reset pagination state
        setDisplayedCount(0)
        setSearchQuery(query)
      } else {
        console.warn('[SearchModal] Query too short for search:', query)
        setAllResults([])
        setDisplayedResults([])
        setDisplayedCount(0)
        setHasMoreToDisplay(false)
      }
    }
  }

  // Cleanup the debounce timer when the component unmounts
  onCleanup(() => {
    debouncedSearch.cancel()
    console.debug('[SearchModal] cleanup debouncing search')
  })

  // Load more function that just shows more of the already loaded results
  const loadMoreResults = async () => {
    console.debug('[SearchModal] Loading more results from cached results')
    const current = displayedCount()
    const nextBatch = allResults().slice(current, current + FEED_PAGE_SIZE)
    
    if (nextBatch.length === 0) {
      setHasMoreToDisplay(false)
      return [] as LoadMoreItems
    }
    
    setDisplayedCount(current + nextBatch.length)
    setHasMoreToDisplay(current + nextBatch.length < allResults().length)
    setDisplayedResults([...displayedResults(), ...nextBatch])
    
    return nextBatch as LoadMoreItems
  }

  const formattedResults = () => {
    return prepareSearchResults(displayedResults(), inputValue());
  }
  
  const hasResults = () => displayedResults().length > 0;
  const searchState = () => (inputValue().trim().length >= 3 ? 'valid' : 'invalid');

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
            // Reset pagination state
            setDisplayedCount(0)
            setSearchQuery(query);
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
        <Show when={hasResults()}>
          <div class={styles.resultsCount}>
            {t('Found')}: {allResults().length} {t('results')}
          </div>
          
          <LoadMoreWrapper
            loadFunction={loadMoreResults}
            pageSize={FEED_PAGE_SIZE}
            hidden={!hasMoreToDisplay()}
          >
            <For each={formattedResults()}>
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

        <Show when={searchState() === 'valid' && !hasResults() && !isLoading()}>
          <p class={styles.searchDescription} innerHTML={t("We couldn't find anything for your request")} />
        </Show>
      </Show>
    </div>
  )
}