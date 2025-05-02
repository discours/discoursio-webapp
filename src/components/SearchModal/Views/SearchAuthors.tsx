import { For, Show } from 'solid-js'
import { AuthorSearchItem } from './../AuthorSearchItem'
import { SearchAuthorsProps } from './types'
import styles from './../Styles/SearchModal.module.scss'

export const SearchAuthors = (props: SearchAuthorsProps) => {
  return (
    <div class={styles.searchResults}>
      <Show when={props.authorsList.length > 0}>
        <div class={styles.searchAuthorsColumn}>
          <For each={props.authorsList}>
            {(author) => (
              <div>
                <AuthorSearchItem author={author} />
              </div>
            )}
          </For>
        </div>
      </Show>
      
      <Show when={props.isLoading}>
        <div class={styles.loadingContainer}>
          <div class={styles.searchLoader} />
        </div>
      </Show>
    </div>
  )
}