import { Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Shout, Topic } from '~/graphql/schema/core.gen'
import { capitalize } from '~/utils/capitalize'
import { Icon } from '../_shared/Icon'
import Group from './Group'

import styles from './TopicShoutsGroup.module.scss'

export const TopicShoutsGroup = (props: { shouts: Shout[]; topic: Topic }) => {
  const { t } = useLocalize()

  return (
    <Show when={Boolean(props.topic)}>
      <Group
        articles={props.shouts || []}
        header={
          <div class={styles.randomTopicHeaderContainer}>
            <div class={styles.randomTopicHeader}>{capitalize(props.topic?.title || '', true)}</div>
            <div>
              <a class={styles.randomTopicHeaderLink} href={`/topic/${props.topic?.slug || ''}`}>
                {t('All articles')} <Icon class={styles.icon} name="arrow-right" />
              </a>
            </div>
          </div>
        }
      />
    </Show>
  )
}
