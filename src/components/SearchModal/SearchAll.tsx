import { For, Show } from 'solid-js'

import { AuthorBadge } from '~/components/Author/AuthorBadge'
import { ArticleCard } from '~/components/Feed/ArticleCard'
import { TopicBadge } from '~/components/Topic/TopicBadge/TopicBadge'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import styles from './SearchModal.module.scss'
import { SearchAllProps } from './types'
import { getSearchCoincidences } from './utils'

export const SearchAll = (props: SearchAllProps) => {
  const { t } = useLocalize()
  const { hideModal } = useUI()

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

  const handleArticleClick = () => {
    hideModal()
  }

  return (
    <div class={styles.searchResults}>
      {/* First 5 shouts */}
      <For each={prepareSearchResults(props.shoutsList.slice(0, 5))}>
        {(article) => (
          <div onClick={handleArticleClick}>
            <ArticleCard
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

      {/* Topics and Authors in two columns */}
      <Show when={props.authorsList.length > 0 || props.topicsList.length > 0}>
        <div class={styles.searchAllBlock}>
          <div class={styles.searchAllBlockGrid}>
            {/* Topics column */}
            <div>
              <h3 class={styles.searchAllBlockTitle}>{t('Topics')}</h3>
              <div class={styles.searchAuthorsColumn}>
                <For each={props.topicsList.slice(0, 6)}>
                  {(topic) => <TopicBadge topic={topic} showStat={true} onClick={hideModal} />}
                </For>
              </div>
            </div>

            {/* Authors column */}
            <div>
              <h3 class={styles.searchAllBlockTitle}>{t('Authors')}</h3>
              <div class={styles.searchAuthorsColumn}>
                <For each={props.authorsList.slice(0, 6)}>
                  {(author) => (
                    <div>
                      <AuthorBadge author={author} showMessageButton={false} onClick={hideModal} />
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
