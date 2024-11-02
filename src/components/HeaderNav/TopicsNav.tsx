import { A, useMatch } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createSignal, on, onMount } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import type { Topic } from '~/graphql/schema/core.gen'
import { notLatin } from '~/intl/chars'
import { getRandomItemsFromArray } from '~/utils/random'

import styles from './TopicsNav.module.scss'

export const RandomTopics = () => {
  const { sortedTopics } = useTopics()
  const { lang, t } = useLocalize()
  const tag = (topic: Topic) =>
    notLatin.test(topic.title || '') && lang() !== 'ru' ? topic.slug : topic.title
  const [randomTopics, setRandomTopics] = createSignal<Topic[]>([])
  createEffect(
    on(sortedTopics, (ttt: Topic[]) => {
      if (ttt?.length > 0) {
        setRandomTopics(getRandomItemsFromArray(ttt))
      }
    })
  )
  onMount(() => sortedTopics() && getRandomItemsFromArray(sortedTopics()))
  return (
    <ul class="nodash">
      <Show when={randomTopics().length > 0}>
        <For each={randomTopics()}>
          {(topic: Topic) => (
            <li class="item">
              <A href={`/topic/${topic.slug}`}>
                <span>#{tag(topic)}</span>
              </A>
            </li>
          )}
        </For>
        <li class={styles.rightItem}>
          <A href="/topic">
            {t('All topics')}
            <Icon name="arrow-right-black" class={clsx(styles.icon, styles.rightItemIcon)} />
          </A>
        </li>
      </Show>
    </ul>
  )
}

export const TopicsNav = () => {
  const { t } = useLocalize()
  const matchExpo = useMatch(() => '/expo')
  return (
    <nav class={clsx('wide-container text-2xl', styles.Topics)}>
      <ul class={styles.list}>
        <li class={styles.item}>
          <A class={clsx({ [styles.selected]: matchExpo() })} href="/expo">
            {t('Art')}
          </A>
        </li>
        {/*<li class={styles.item}>
          <A href="/podcasts">{t('Podcasts')}</A>
        </li>
        <li class={styles.item}>
          <A href="/projects">{t('Special projects')}</A>
        </li>*/}
        <li class={styles.item}>
          <A href="/topic/interview">#{t('Interview')}</A>
        </li>
        <li class={styles.item}>
          <A href="/topic/reportage">#{t('Reports')}</A>
        </li>
        <li class={styles.item}>
          <A href="/topic/empiric">#{t('Experience')}</A>
        </li>
        <li class={styles.item}>
          <A href="/topic/society">#{t('Society')}</A>
        </li>
        <li class={styles.item}>
          <A href="/topic/culture">#{t('Culture')}</A>
        </li>
        <li class={styles.item}>
          <A href="/topic/theory">#{t('Theory')}</A>
        </li>
        <li class={styles.item}>
          <A href="/topic/poetry">#{t('Poetry')}</A>
        </li>
        <li class={clsx(styles.item, styles.right)}>
          <A href={'/topic'}>
            <span>
              {t('All topics')}
              <Icon name="arrow-right-black" class={'icon'} />
            </span>
          </A>
        </li>
      </ul>
    </nav>
  )
}
