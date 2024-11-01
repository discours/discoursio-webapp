import { For, Show, createSignal, onMount } from 'solid-js'

import { useSearchParams } from '@solidjs/router'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import type { SearchResult, Shout } from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { ArticleCard } from '../Feed/ArticleCard'

import '~/styles/views/Search.module.scss'
import { LoadMoreItems, LoadMoreWrapper } from '../_shared/LoadMoreWrapper'

type Props = {
  query: string
  results: SearchResult[]
}

const LOAD_MORE_PAGE_SIZE = 50

export const SearchView = (props: Props) => {
  const { t } = useLocalize()
  const { sortedFeed, loadShoutsSearch } = useFeed()
  const [isLoadMoreButtonVisible, setIsLoadMoreButtonVisible] = createSignal(false)
  const [query, setQuery] = createSignal(props.query)
  const [offset, setOffset] = createSignal(0)

  const [searchParams] = useSearchParams<{ by?: string }>()
  let searchEl: HTMLInputElement
  const handleQueryChange = () => {
    setQuery(searchEl.value)
  }

  const loadMore = async () => {
    saveScrollPosition()
    let results: Shout[] = []
    if (query()) {
      console.log(query())
      const { hasMore, newShouts } = await loadShoutsSearch({
        text: query(),
        options: {
          offset: offset(),
          limit: LOAD_MORE_PAGE_SIZE
        }
      })
      setIsLoadMoreButtonVisible(hasMore)
      setOffset(offset() + LOAD_MORE_PAGE_SIZE)
      results = newShouts
    } else {
      console.warn('[SaerchView] no query found')
    }
    restoreScrollPosition()
    return results as LoadMoreItems
  }

  onMount(() => {
    const q = window.location.pathname.replace('/search/', '') || props.query
    setQuery(q)
    searchEl.value = q
  })

  // TODO: use score from the search results to sort by relevance

  return (
    <div class="search-page wide-container">
      <form action="/search" class="search-form row">
        <div class="col-sm-18">
          <input
            type="search"
            name="q"
            ref={(el) => (searchEl = el)}
            onInput={handleQueryChange}
            placeholder={query() || `${t('Enter text')}...`}
          />
        </div>
        <div class="col-sm-6">
          <button class="button" type="submit" onClick={loadMore}>
            {t('Search')}
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

      <Show when={sortedFeed()?.length > 0}>
        <h3>{t('Publications')}</h3>

        <div class="floor">
          <div class="row">
            <LoadMoreWrapper
              pageSize={LOAD_MORE_PAGE_SIZE}
              hidden={!isLoadMoreButtonVisible()}
              loadFunction={loadMore}
            >
              <For each={sortedFeed()}>
                {(article) => (
                  <div class="col-md-6">
                    <ArticleCard article={article} desktopCoverSize="L" />
                  </div>
                )}
              </For>
            </LoadMoreWrapper>

            <Show when={isLoadMoreButtonVisible()}>
              <div class="col-md-6">
                <a href={`/search/${query()}`} onClick={loadMore} class="search__show-more">
                  <span class="search__show-more-inner">{t('Load more')}</span>
                </a>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
