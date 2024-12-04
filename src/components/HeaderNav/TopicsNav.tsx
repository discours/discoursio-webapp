import { A, useMatch } from '@solidjs/router'
import { clsx } from 'clsx'
import { Accessor, For, createEffect, createSignal, untrack } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { useLocalize } from '~/context/localize'
import type { Topic } from '~/graphql/schema/core.gen'
import { capitalize } from '~/utils/capitalize'
import { getRandomItemsFromArray } from '~/utils/random'

import { useTopics } from '~/context/topics'
import styles from './TopicsNav.module.scss'

export const DEFAULT_TOPICS = [
  'interview',
  'reportage',
  'empiric',
  'society',
  'culture',
  'theory',
  'poetry'
]

export const TopicsNav = (props: { fixed?: boolean }) => {
  const { t, lang } = useLocalize()
  const { sortedTopics } = useTopics()
  const [randomTopics, setRandomTopics] = createSignal<string[]>(DEFAULT_TOPICS)

  createEffect(() => {
    if (props.fixed) return

    const topics = untrack(sortedTopics) as Topic[]
    if (!topics?.length) return

    const slugs = topics.map((t: Topic) => t.slug).filter(Boolean)
    if (!slugs.length) return

    const randomItems = getRandomItemsFromArray(slugs, 7) as string[]
    setRandomTopics(randomItems)
  })

  const matchExpo = useMatch(() => '/expo')
  return (
    <div class={clsx('wide-container', styles.Topics)}>
      <ul class={clsx(styles.nodash, styles.list)}>
        <li class={styles.item}>
          <A class={clsx({ [styles.selected]: matchExpo() })} href="/expo">
            {t('Art')}
          </A>
        </li>
        <For each={randomTopics()}>
          {(slug: string, _idx: Accessor<number>) => {
            const topic = sortedTopics()?.find((t: Topic) => t.slug === slug)
            return (
              <li class={styles.item}>
                <A href={`/topic/${slug}`}>
                  <span>
                    #
                    {capitalize(
                      (lang() === 'ru' && topic?.title) || t(capitalize(slug)) || slug.replace('-', ' ')
                    )}
                  </span>
                </A>
              </li>
            )
          }}
        </For>
        <li class={styles.rightItem}>
          <A href="/topics">
            {t('All topics')}
            <Icon name="arrow-right-black" class={clsx(styles.icon, styles.rightItemIcon)} />
          </A>
        </li>
      </ul>
    </div>
  )
}
