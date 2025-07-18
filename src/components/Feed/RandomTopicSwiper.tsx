import { createEffect, Show } from 'solid-js'
import { useAuthors } from '~/context/authors'
import { useFeaturedFeed } from '~/context/featured'
import { useLocalize } from '~/context/localize'
import { Author, Shout } from '~/graphql/generated/graphql'
import { capitalize } from '~/utils/capitalize'
import { Icon } from '../_shared/Icon'
import Group from './Group'

import styles from './RandomTopicSwiper.module.scss'

export const RandomTopicSwiper = () => {
  const { t } = useLocalize()
  const { randomTopicFeed } = useFeaturedFeed()
  const { addAuthors } = useAuthors()

  // Добавляем авторов в контекст при получении данных
  createEffect(() => {
    const feedData = randomTopicFeed()
    if (feedData?.shouts) {
      feedData.shouts.forEach((s: Shout) => addAuthors((s?.authors || []) as Author[]))
    }
  })

  return (
    <Show when={randomTopicFeed()?.topic && randomTopicFeed()?.shouts?.length}>
      <Group
        articles={randomTopicFeed()?.shouts?.slice(0, 5) || []}
        header={
          <div class={styles.randomTopicHeaderContainer}>
            <div class={styles.randomTopicHeader}>
              {capitalize(randomTopicFeed()?.topic?.title || '', true)}
            </div>
            <div>
              <a
                class={styles.randomTopicHeaderLink}
                href={`/topic/${randomTopicFeed()?.topic?.slug || ''}`}
              >
                {t('All articles')} <Icon class={styles.icon} name="arrow-right" />
              </a>
            </div>
          </div>
        }
      />
    </Show>
  )
}
