import { For, Show } from 'solid-js'

import { AuthorBadge } from '~/components/Author/AuthorBadge'
import { useUI } from '~/context/ui'
import styles from './SearchModal.module.scss'
import { SearchAuthorsProps } from './types'

export const SearchAuthors = (props: SearchAuthorsProps) => {
  const { hideModal } = useUI()

  const handleAuthorClick = () => {
    hideModal()
  }

  return (
    <div class={styles.searchResults}>
      <Show when={props.authorsList.length > 0}>
        <div class={styles.searchAuthorsColumn}>
          <For each={props.authorsList}>
            {(author) => (
              <div onClick={handleAuthorClick}>
                <AuthorBadge author={author} showMessageButton={false} />
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
