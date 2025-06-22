import { A, useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { Loading } from '~/components/_shared/Loading'
import { SearchField } from '~/components/_shared/SearchField'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import type { Topic } from '~/graphql/schema/core.gen'
import { findFirstReadableCharIndex, notLatin, notRus } from '~/intl/chars'
import styles from '~/styles/views/AllTopics.module.scss'
import { capitalize } from '~/utils/capitalize'
import { scrollHandler } from '~/utils/scroll'
import { TopicBadge } from '../Topic/TopicBadge/TopicBadge'

const TOPICS_PAGE_LAYOUTS = ['shouts', 'authors', 'title']

type TabNavigatorProps = {
  setLayout: (layout: string) => void
  setSearchQuery: (query: string) => void
}

export const TabNavigator = ({ setLayout, setSearchQuery }: TabNavigatorProps) => {
  const { t } = useLocalize()
  const [searchParams] = useSearchParams<{ by?: string }>()

  const layouts = [...TOPICS_PAGE_LAYOUTS]

  return (
    <div class="offset-md-5">
      <div class="row">
        <div class="col-lg-20 col-xl-18">
          <h1>{t('Topics')}</h1>
          <p>{t('Subscribe what you like to tune your personal feed')}</p>
          <ul class={clsx(styles.viewSwitcher, 'view-switcher')}>
            <For each={layouts}>
              {(layout) => (
                <li
                  class={clsx({
                    'view-switcher__item--selected':
                      searchParams?.by === layout || (!searchParams?.by && layout === 'shouts')
                  })}
                  onClick={() => setLayout(layout)}
                >
                  <A href={`/topic?by=${layout}`}>
                    <span class="linkReplacement">{t(`By ${layout}`)}</span>
                  </A>
                </li>
              )}
            </For>
            <Show when={searchParams?.by === 'title'}>
              <li class="view-switcher__search">
                <SearchField onChange={(value) => setSearchQuery(value)} />
              </li>
            </Show>
          </ul>
        </div>
      </div>
    </div>
  )
}

type Props = {
  topics: Topic[]
  isLoaded: boolean
}

export const ABC = {
  ru: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ#',
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'
}

export const AllTopicsView = (props: Props) => {
  const { lang } = useLocalize()
  const { topicEntities } = useTopics()
  const alphabet = createMemo(() => ABC[lang()] || ABC['ru'])
  const [searchParams] = useSearchParams<{ by?: string }>()
  const [layout, setLayout] = createSignal(searchParams.by || 'shouts')
  const [searchQuery, setSearchQuery] = createSignal('')

  // Watch for changes in the URL and update the layout state
  createEffect(() => {
    setLayout(searchParams.by || 'shouts')
  })

  // Функция для получения топика со статистикой из контекста
  const getTopicWithStat = (topic: Topic): Topic => {
    const contextTopic = topicEntities()[topic.slug]
    // Если в контексте есть топик со статистикой, используем его
    if (contextTopic?.stat) {
      return contextTopic
    }
    // Иначе возвращаем исходный топик
    return topic
  }

  // Memo to store topics grouped by the first letter and sorted by the alphabet
  const byLetterFiltered = createMemo<{ [letter: string]: Topic[] }>(() => {
    if (!props.topics || !Array.isArray(props.topics)) return {}

    // Применяем поиск только на вкладке 'title'
    const filteredTopics =
      layout() === 'title' && searchQuery().trim()
        ? props.topics.filter(
            (topic) =>
              topic.title?.toLowerCase().includes(searchQuery().toLowerCase()) ||
              topic.slug?.toLowerCase().includes(searchQuery().toLowerCase())
          )
        : props.topics

    const groupedTopics =
      filteredTopics?.reduce(
        (acc, topic) => {
          const firstCharIndex = findFirstReadableCharIndex(topic?.title || '')
          let letter =
            lang() === 'en'
              ? topic.slug[0].toUpperCase()
              : (topic?.title?.[firstCharIndex] || '').toUpperCase()
          if (notRus.test(letter) && lang() === 'ru') letter = '#'
          if (notLatin.test(letter) && lang() === 'en') letter = '#'
          if (!acc[letter]) acc[letter] = []
          acc[letter].push(topic)
          return acc
        },
        {} as { [letter: string]: Topic[] }
      ) || {}

    // Sort the keys based on the alphabet
    const sortedGroupedTopics: { [letter: string]: Topic[] } = {}
    for (const letter of alphabet()) {
      if (groupedTopics[letter]) {
        sortedGroupedTopics[letter] = groupedTopics[letter]
      }
    }

    return sortedGroupedTopics
  })

  // Component to render the alphabet navigator
  const AbcNavigator = () => (
    <div class="row">
      <div class="col-lg-20 col-xl-18">
        <ul class={clsx('nodash', styles.alphabet)}>
          <For each={[...(alphabet() || [])]}>
            {(letter, index) => (
              <li>
                <Show when={letter in byLetterFiltered()} fallback={letter}>
                  <A
                    href={`/topic?by=title#letter-${index()}`}
                    onClick={(event) => {
                      event.preventDefault()
                      scrollHandler(`letter-${index()}`)
                    }}
                  >
                    {letter}
                  </A>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  )

  // Component to render the list of topics grouped by the first letter of their title
  const AbcTopicsList = () => {
    return (
      <For each={alphabet().split('')}>
        {(letter) => (
          <Show when={byLetterFiltered()[letter]}>
            <div class={clsx(styles.group, 'group')}>
              <h2 id={`letter-${alphabet()?.indexOf(letter) || ''}`}>{letter}</h2>
              <div class="container">
                <div class="row">
                  <div class="col-lg-20">
                    <div class="row">
                      <For each={byLetterFiltered()[letter]}>
                        {(topic) => {
                          const topicWithStat = getTopicWithStat(topic)
                          return (
                            <div class={clsx(styles.topic, 'topic col-sm-12 col-md-8')}>
                              <div class="topic-title">
                                <A href={`/topic/${topic.slug}`}>
                                  {lang() !== 'ru'
                                    ? capitalize(topic.slug.replaceAll('-', ' ') as string)
                                    : topic.title}
                                </A>
                                <Show
                                  when={topicWithStat.stat?.shouts && (topicWithStat.stat?.shouts || 0) > 0}
                                >
                                  <span class={styles.articlesCounter}>
                                    {topicWithStat.stat?.shouts || 0}
                                  </span>
                                </Show>
                              </div>
                            </div>
                          )
                        }}
                      </For>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Show>
        )}
      </For>
    )
  }

  // Component to render the sorted list of topics - используется для вкладок shouts и authors
  const TopicsSortedList = () => (
    <div class={clsx(styles.TopicsList)}>
      <For each={props.topics}>
        {(topic) => (
          <div class="row">
            <div class="col-lg-20 col-xl-18">
              <TopicBadge topic={topic} showStat={true} />
            </div>
          </div>
        )}
      </For>
      <div class="row">
        <div class="col-lg-20 col-xl-18">
          <div class={styles.action} />
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Show when={props.isLoaded} fallback={<Loading />}>
        <TabNavigator setLayout={setLayout} setSearchQuery={setSearchQuery} />
        <div class="offset-md-5">
          <Show when={layout() === 'title'}>
            <AbcNavigator />
            <AbcTopicsList />
          </Show>
          <Show when={layout() === 'authors' || layout() === 'shouts'}>
            <TopicsSortedList />
          </Show>
        </div>
      </Show>
    </>
  )
}
