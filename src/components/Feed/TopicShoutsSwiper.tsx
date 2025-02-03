import { Show, createEffect, createSignal, on } from 'solid-js'
import { useAuthors } from '~/context/authors'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { loadShouts } from '~/graphql/api/public'
import { Author, Shout, Topic } from '~/graphql/schema/core.gen'
import { capitalize } from '~/utils/capitalize'
import { Icon } from '../_shared/Icon'
import Group from './Group'

import styles from './TopicShoutsSwiper.module.scss'

export const TopicShoutsSwiper = (props: { shouts: Shout[] }) => {
  const { t } = useLocalize()
  const { randomTopic } = useTopics()
  const { addAuthors } = useAuthors()

  return (
    <Show when={Boolean(randomTopic())}>
      <Group
        articles={props.shouts || []}
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
    </Show>
  )
}
