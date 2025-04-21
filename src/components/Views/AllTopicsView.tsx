import { A, useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from 'solid-js'
import { Loading } from '~/components/_shared/Loading'
import { SearchField } from '~/components/_shared/SearchField'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import type { Topic } from '~/graphql/schema/core.gen'
import { findFirstReadableCharIndex, notLatin, notRus } from '~/intl/chars'
import { dummyFilter } from '~/intl/dummyFilter'
import { capitalize } from '~/utils/capitalize'
import { scrollHandler } from '~/utils/scroll'
import { TopicBadge } from '../Topic/TopicBadge/TopicBadge'

import styles from '~/styles/views/AllTopics.module.scss'

export const ABC = {
  ru: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ#',
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'
}

export const AllTopicsView = () => {
  const { t, lang } = useLocalize()
  const alphabet = createMemo(() => ABC[lang()])
  const {
    setTopicsSort,
    topicsByAuthors,
    topicsByShouts,
    sortedTopics,
    loadMoreTopics,
    hasMore,
    isLoading
  } = useTopics()
  const [searchParams, changeSearchParams] = useSearchParams<{ by?: string }>()
  onMount(() => changeSearchParams({ by: 'shouts' }))
  createEffect(on(() => searchParams?.by || 'shouts', setTopicsSort, { defer: true }))

  // Выбираем соответствующий список топиков в зависимости от режима сортировки
  const currentTopicsList = createMemo<Topic[]>(() => {
    const currentSortBy = searchParams?.by || 'shouts'

    if (currentSortBy === 'authors') {
      return topicsByAuthors()
    }

    if (currentSortBy === 'title') {
      return sortedTopics()
    }

    return topicsByShouts()
  })

  // sorted derivative для алфавитного отображения
  const byLetter = createMemo<{ [letter: string]: Topic[] }>(() => {
    // Используем только для сортировки по заголовку
    if (searchParams?.by === 'title') {
      return sortedTopics().reduce(
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
      )
    }
    return {}
  })

  // helper memo
  const sortedKeys = createMemo<string[]>(() => {
    const keys = Object.keys(byLetter())
    if (keys) {
      keys.sort()
      const firstKey: string = keys.shift() || ''
      keys.push(firstKey)
    }
    return keys
  })

  // filter
  const [searchQuery, setSearchQuery] = createSignal('')
  const [filteredResults, setFilteredResults] = createSignal<Topic[]>([])
  createEffect(() =>
    setFilteredResults(
      (_prev: Topic[]) => dummyFilter(currentTopicsList(), searchQuery(), lang()) as Topic[]
    )
  )

  // Обработчик прокрутки для бесконечной загрузки
  const handleScroll = () => {
    if (isLoading()) return

    // Проверяем, достигли ли мы конца страницы
    const scrollPosition = window.scrollY + window.innerHeight
    const documentHeight = document.documentElement.scrollHeight

    // Загружаем больше данных, когда пользователь прокрутил почти до конца
    if (scrollPosition >= documentHeight - 300 && hasMore()) {
      loadMoreTopics()
    }
  }

  // Добавляем обработчик прокрутки при монтировании
  onMount(() => {
    // Привязываем функцию handleScroll к объекту window
    window.addEventListener('scroll', handleScroll)
    // Удаляем обработчик прокрутки при размонтировании
    onCleanup(() => {
      // Используем ту же функцию handleScroll при удалении слушателя
      window.removeEventListener('scroll', handleScroll)
    })
  })

  // subcomponent
  const AllTopicsHead = () => (
    <div class="row">
      <div class="col-lg-18 col-xl-15">
        <h1>{t('Topics')}</h1>
        <p>{t('Subscribe what you like to tune your personal feed')}</p>

        <ul class="view-switcher">
          <li classList={{ 'view-switcher__item--selected': searchParams?.by === 'shouts' }}>
            <A href="/topic?by=shouts">{t('By shouts')}</A>
          </li>
          <li classList={{ 'view-switcher__item--selected': searchParams?.by === 'authors' }}>
            <A href="/topic?by=authors">{t('By authors')}</A>
          </li>
          <li classList={{ 'view-switcher__item--selected': searchParams?.by === 'title' }}>
            <A href="/topic?by=title">{t('By title')}</A>
          </li>
          <Show when={searchParams?.by !== 'title'}>
            <li class="view-switcher__search">
              <SearchField onChange={(value) => setSearchQuery(value)} />
            </li>
          </Show>
        </ul>
      </div>
    </div>
  )
  const AllTopicAlphabeticallyHead = () => (
    <div class="col-lg-20 col-xl-18">
      <ul class={clsx('nodash', styles.alphabet)}>
        <For each={[...alphabet()]}>
          {(letter, index) => (
            <li>
              <Show when={letter in byLetter()} fallback={letter}>
                <a
                  href={`/topic?by=title#letter-${index()}`}
                  onClick={(event) => {
                    event.preventDefault()
                    scrollHandler(`letter-${index()}`)
                  }}
                >
                  {letter}
                </a>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
  const AllTopicAlphabetically = () => (
    <For each={sortedKeys()}>
      {(letter) => (
        <div class={clsx(styles.group, 'group')}>
          <h2 id={`letter-${alphabet().indexOf(letter)}`}>{letter}</h2>
          <div class="row">
            <div class="col-lg-20">
              <div class="row">
                <For each={byLetter()[letter]}>
                  {(topic) => (
                    <div class={clsx(styles.topicTitle, 'col-sm-12 col-md-8')}>
                      <A href={`/topic/${topic.slug}`}>
                        {lang() !== 'ru' ? capitalize(topic.slug.replaceAll('-', ' ')) : topic.title}
                      </A>
                      <Show when={topic.stat?.shouts || 0}>
                        <span class={styles.articlesCounter}>{topic.stat?.shouts || 0}</span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      )}
    </For>
  )
  return (
    <>
      <Show when={Boolean(filteredResults())} fallback={<Loading />}>
        <div class="row">
          <div class="col-md-19 offset-md-5">
            <AllTopicsHead />

            <Show when={filteredResults().length > 0}>
              <Show when={searchParams?.by === 'title'}>
                <AllTopicAlphabeticallyHead />
                <AllTopicAlphabetically />
              </Show>

              <Show when={searchParams?.by && searchParams?.by !== 'title'}>
                <div class="row">
                  <div class="col-lg-18 col-xl-15 py-4">
                    <For each={filteredResults()}>
                      {(topic) => <TopicBadge topic={topic} showStat={true} />}
                    </For>
                  </div>
                </div>
              </Show>
            </Show>

            <Show when={isLoading()}>
              <div class="row py-4">
                <div class="col-12 text-center">
                  <Loading />
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </>
  )
}
