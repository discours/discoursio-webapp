import { For, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import styles from './../Styles/SearchModal.module.scss'
import { SearchAllProps } from './types'
import { getSearchCoincidences } from './utils'

import { AuthorBadge } from '../../Author/AuthorBadge'
import { ArticleCard } from '../../Feed/ArticleCard'

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
            <ArticleCard article={article} settings={{
                isFloorImportant: true,
                isSingle: true,
                nodate: true
              }} />
          </div>
        )}
      </For>

      {/* Authors and Topics block - each 6 times */}
      <Show when={props.authorsList.length > 0 || props.topicsList.length > 0}>
        <div class={styles.searchAllBlock}>
          <h3 class={styles.searchBlockTitle}>{t('Authors')}</h3>
          <div class={styles.searchBlockGrid}>
            <For each={props.authorsList.slice(0, 6)}>
              {(author) => (
                <div class={styles.searchBlockItem}>
                  <AuthorBadge author={author} showMessageButton={false} />
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
