import { For, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import styles from './../Styles/SearchModal.module.scss'
import { AuthorsResultItem } from './AuthorsResultItem'
import { ShoutsResultItem } from './ShoutsResultItem'
import { SearchAllProps } from './types'
import { getSearchCoincidences } from './utils'

export const SearchAll = (props: SearchAllProps) => {
  const { t } = useLocalize()

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
      {/* First 5 shouts */}
      <For each={prepareSearchResults(props.shoutsList.slice(0, 5))}>
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

      {/* Authors block - first 6 authors */}
      <Show when={props.authorsList.length > 0}>
        <div class={styles.searchAuthorsBlock}>
          <h3 class={styles.searchAuthorsTitle}>{t('Authors')}</h3>
          <div class={styles.searchAuthorsGrid}>
            <For each={props.authorsList.slice(0, 6)}>
              {(author) => (
                <div class={styles.searchAuthorsItem}>
                  <AuthorsResultItem author={author} />
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
