import { For, Show, createResource, createSignal, onCleanup } from 'solid-js'
import { debounce } from 'throttle-debounce'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { SHOUTS_PER_PAGE, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import type { Shout } from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { byScore } from '~/utils/sort'
import { FEED_PAGE_SIZE } from '../Views/FeedView'
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
  const { loadShoutsSearch } = useFeed()
  const [isLoadMoreButtonVisible, setIsLoadMoreButtonVisible] = createSignal(false)
  const [inputValue, setInputValue] = createSignal('')
  const [isLoading, setIsLoading] = createSignal(false)
  const [offset, setOffset] = createSignal<number>(0)

  const fetchSearchResults = async () => {
    setIsLoading(true)
    saveScrollPosition()
    const { hasMore, newShouts } = await loadShoutsSearch({
      text: inputValue(),
      options: {
        offset: offset(),
        limit: FEED_PAGE_SIZE
      }
    })
    setIsLoading(false)
    setOffset(newShouts.length)
    setIsLoadMoreButtonVisible(hasMore)
    return newShouts
  }
  const [searchResultsList, { refetch: loadSearchResults, mutate: setSearchResultsList }] = createResource<
    Shout[]
  >(fetchSearchResults, { ssrLoadFrom: 'initial', initialValue: [] })

  const [searchEl, setSearchEl] = createSignal<HTMLInputElement | undefined>()
  const debouncedLoadMore = debounce(500, loadSearchResults)

  const handleQueryInput = async () => {
    setInputValue(searchEl()?.value ?? '')
    if ((searchEl()?.value?.length || 0) > 2) {
      await debouncedLoadMore()
    } else {
      setIsLoading(false)
      setSearchResultsList([])
    }
  }

  const enterQuery = async (ev: KeyboardEvent) => {
    setIsLoading(true)
    if (ev.key === 'Enter' && inputValue().length > 2) {
      await debouncedLoadMore()
    } else {
      setIsLoading(false)
      setSearchResultsList([])
    }
    restoreScrollPosition()
    setIsLoading(false)
  }

  // Cleanup the debounce timer when the component unmounts
  onCleanup(() => {
    debouncedLoadMore.cancel()
    // console.debug('[SearchModal] cleanup debouncing search')
  })

  const loadMoreResults = async () => {
    const result = await fetchSearchResults()
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
        onClick={debouncedLoadMore}
        value={isLoading() ? <div class={styles.searchLoader} /> : <Icon name="search" />}
      />

      <p
        class={styles.searchDescription}
        innerHTML={t(
          'To find publications, art, comments, authors and topics of interest to you, just start typing your query'
        )}
      />

      <Show when={!isLoading()}>
        <Show when={searchResultsList()}>
          <LoadMoreWrapper
            loadFunction={loadMoreResults}
            pageSize={SHOUTS_PER_PAGE}
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

        <Show when={Array.isArray(searchResultsList()) && searchResultsList().length === 0}>
          <p class={styles.searchDescription} innerHTML={t("We couldn't find anything for your request")} />
        </Show>
      </Show>

      {/* @@TODO handle filter */}
      {/* <Show when={FILTERS.length}>
        <div class={styles.filterResults}>
          <For each={FILTERS}>
            {(filter) => (
              <button
                type="button"
                class={styles.filterResultsControl}
                onClick={() => setActiveFilter(filter)}
              >
                {filter.name}
              </button>
            )}
          </For>
        </div>
      </Show> */}

      {/* @@TODO handle topics */}
      {/* <Show when={TOPICS.length}>
        <div class="container-xl">
          <div class="row">
            <div class={clsx('col-md-18 offset-md-2', styles.topicsList)}>
              <For each={TOPICS}>
                {(topic) => (
                  <button type="button" class={styles.topTopic} onClick={() => setActiveTopic(topic)}>
                    {topic.name}
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show> */}
    </div>
  )
}
