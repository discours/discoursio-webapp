import { For, Show } from 'solid-js'
import styles from './../Styles/SearchModal.module.scss'
import { ShoutsResultItem } from './ShoutsResultItem'
import { SearchShoutsProps } from './types'
import { getSearchCoincidences } from './utils'

export const SearchShouts = (props: SearchShoutsProps) => {
  const prepareSearchResults = (list: typeof props.shoutsList) =>
    list.map((article) => ({
      ...article,
      title: article.title
        ? getSearchCoincidences({
            str: article.title,
            intersection: props.searchValue
          })
        : '',
      subtitle: article.subtitle
        ? getSearchCoincidences({
            str: article.subtitle,
            intersection: props.searchValue
          })
        : ''
    }))

  return (
    <div class={styles.searchResults}>
      <For each={prepareSearchResults(props.shoutsList)}>
        {(article) => (
          <div>
            <ShoutsResultItem
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
      <div ref={props.setSentinelEl} data-testid="search-sentinel" style={props.sentinelStyle}>
        <Show when={props.isLoading && props.hasMore}>
          <div class={styles.searchLoader} />
        </Show>
      </div>
    </div>
  )
}
