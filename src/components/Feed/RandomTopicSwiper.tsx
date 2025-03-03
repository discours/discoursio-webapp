import { Show, Suspense, createResource } from 'solid-js'
import { useAuthors } from '~/context/authors'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { loadShouts } from '~/graphql/api/public'
import { Author, Shout, Topic } from '~/graphql/schema/core.gen'
import { capitalize } from '~/utils/capitalize'
import { Icon } from '../_shared/Icon'
import Group from './Group'

import styles from './RandomTopicSwiper.module.scss'

export const RandomTopicSwiper = () => {
  const { t } = useLocalize()
  const { randomTopic } = useTopics()
  const { addAuthors } = useAuthors()

  const [articles] = createResource(randomTopic, async (topic: Topic) => {
    const shoutsByTopicLoader = loadShouts({
      options: {
        filters: { topic: topic.slug, featured: true },
        limit: 5,
        offset: 0
      }
    })
    const shouts = await shoutsByTopicLoader()
    shouts?.forEach((s: Shout) => addAuthors((s?.authors || []) as Author[]))
    return shouts || []
  })

  return (
    <Show when={randomTopic()}>
      <Suspense>
        <Group
          articles={articles() || []}
          header={
            <div class={styles.randomTopicHeaderContainer}>
              <div class={styles.randomTopicHeader}>{capitalize(randomTopic()?.title || '', true)}</div>
              <div>
                <a class={styles.randomTopicHeaderLink} href={`/topic/${randomTopic()?.slug || ''}`}>
                  {t('All articles')} <Icon class={styles.icon} name="arrow-right" />
                </a>
              </div>
            </div>
          }
        />
      </Suspense>
    </Show>
  )
}
