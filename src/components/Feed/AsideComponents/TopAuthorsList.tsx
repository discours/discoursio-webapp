import { A } from '@solidjs/router'
import { For, Show } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { AuthorLink } from '~/components/Author/AuthorLink'
import { AsideSection } from '~/components/Feed/AsideComponents/AsideSection'
import { useLocalize } from '~/context/localize'
import { Author } from '~/graphql/schema/core.gen'
import styles from './TopAuthorsList.module.scss'

export interface TopAuthorsListProps {
  authors: Author[]
  title?: string
  maxItems?: number
  collapsible?: boolean
  showViewAll?: boolean
}

export const TopAuthorsList = (props: TopAuthorsListProps) => {
  const { t } = useLocalize()

  const visibleAuthors = () => {
    const authors = props.authors || []
    return props.maxItems ? authors.slice(0, props.maxItems) : authors
  }

  return (
    <Show when={props.authors?.length > 0}>
      <AsideSection
        title={props.title || t('Top authors')}
        icon="users"
        collapsible={props.collapsible}
        class={styles.authorsSection}
      >
        <div class={styles.authorsList}>
          <For each={visibleAuthors()}>
            {(author, index) => (
              <div class={styles.authorItem}>
                <span class={styles.authorRank}>#{index() + 1}</span>
                <AuthorLink author={author} size={'M'} class={styles.authorLink} />
              </div>
            )}
          </For>

          <Show when={props.showViewAll}>
            <div class={styles.viewAll}>
              <A href="/authors" class={styles.viewAllLink}>
                <span>{t('All authors')}</span>
                <Icon name="arrow-right" class={styles.viewAllIcon} />
              </A>
            </div>
          </Show>
        </div>
      </AsideSection>
    </Show>
  )
}
