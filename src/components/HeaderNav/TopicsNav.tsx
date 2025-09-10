import { A, useMatch } from '@solidjs/router'
import { clsx } from 'clsx'
import { Accessor, createMemo, For, Show } from 'solid-js'

import { Icon } from '~/components/_shared/Icon'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import type { Topic } from '~/graphql/generated/graphql'
import { capitalize } from '~/utils/capitalize'

import styles from './TopicsNav.module.scss'

export const DEFAULT_TOPICS = ['interview', 'reportage', 'empiric', 'society', 'culture', 'theory', 'poetry']

export const TopicsNav = (props: { fixed?: boolean; inSubnavigation?: boolean }) => {
  const { t, lang } = useLocalize()
  const { sortedTopics, randomNavTopics } = useTopics()

  // Используем стабильные топики из контекста
  // вместо генерации случайных в компоненте
  const navTopics = createMemo(() => {
    const contextTopics = randomNavTopics()
    // Фоллбэк на DEFAULT_TOPICS если контекст еще не загружен
    return contextTopics.length > 0 ? contextTopics : DEFAULT_TOPICS
  })

  const matchExpo = useMatch(() => '/expo')

  const listClasses = clsx(
    'd-flex flex-nowrap flex-lg-wrap align-items-center overflow-auto position-relative m-0 p-0',
    styles.list,
    styles.nodash
  )

  const getItemClasses = (isRight = false) =>
    clsx(styles.item, {
      'me-4': !isRight && !props.inSubnavigation, // отступ между темами только вне subnavigation
      'ms-auto d-none d-lg-block': isRight // правый элемент
    })

  const getButtonClasses = () =>
    clsx(styles.topicButton, {
      [styles.topicButtonActive]: false // можно добавить логику для активного состояния
    })

  return (
    <div class={clsx('wide-container', styles.Topics)}>
      <ul class={listClasses}>
        <Show when={!props.inSubnavigation}>
          <li class={getItemClasses(false)}>
            <A class={clsx({ [styles.selected]: matchExpo() })} href="/expo">
              {t('Art')}
            </A>
          </li>
        </Show>
        <For each={navTopics()}>
          {(slug: string, _idx: Accessor<number>) => {
            const topic = sortedTopics()?.find((t: Topic) => t.slug === slug)
            return (
              <li class={getItemClasses(false)}>
                <A href={`/topic/${slug}`} class={getButtonClasses()}>
                  <span>
                    {props.inSubnavigation
                      ? capitalize((lang() === 'ru' && topic?.title) || t(capitalize(slug)) || slug.replace('-', ' '))
                      : `#${capitalize((lang() === 'ru' && topic?.title) || t(capitalize(slug)) || slug.replace('-', ' '))}`}
                  </span>
                </A>
              </li>
            )
          }}
        </For>
        <li class={getItemClasses(true)}>
          <A href="/topics" class={getButtonClasses()}>
            {t('All topics')}
            <Icon name="arrow-right-black" class={clsx(styles.icon, styles.rightItemIcon)} />
          </A>
        </li>
      </ul>
    </div>
  )
}
