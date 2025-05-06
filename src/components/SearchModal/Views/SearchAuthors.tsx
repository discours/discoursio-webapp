import { For, Show } from 'solid-js'
import { AuthorsResultItem } from './AuthorsResultItem'
import styles from './../Styles/SearchModal.module.scss'
import { SearchAuthorsProps } from './types'

export const SearchAuthors = (props: SearchAuthorsProps) => {
  return (
    <div class={styles.searchResults}>
      <Show when={props.authorsList.length > 0}>
        <div class={styles.searchAuthorsColumn}>
          <For each={props.authorsList}>
            {(author) => (
              <div>
                <AuthorsResultItem author={author} />
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Sentinel element for infinite scroll */}
      <div ref={props.setSentinelEl} data-testid="search-sentinel-authors" style={props.sentinelStyle}>
        <Show when={props.isLoading && props.hasMore}>
          <div class={styles.searchLoader} />
        </Show>
      </div>
    </div>
  )
}
