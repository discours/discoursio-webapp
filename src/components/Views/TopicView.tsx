import { A, useLocation, useParams } from '@solidjs/router'
import { clsx } from 'clsx'
import {
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  on,
  Show,
  Suspense,
  Switch
} from 'solid-js'
import { FEED_PAGE_SIZE, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { loadAuthors, loadShouts, loadTopicAuthors, loadTopicFollowers } from '~/graphql/api/public'
import { Author, AuthorsBy, LoadShoutsOptions, Shout, Stat, Topic } from '~/graphql/generated/graphql'
import { getUnixtime } from '~/lib/fromPeriod'
import styles from '~/styles/views/Topic.module.scss'
import { FeedDeduplicationContext } from '~/utils/deduplicate'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { Loading } from '../_shared/Loading'
import { LoadMoreItems, LoadMoreWrapper } from '../_shared/LoadMoreWrapper'
import { ArticleCardSwiper } from '../_shared/SolidSwiper/ArticleCardSwiper'
import { AuthorCard } from '../Author/AuthorCard'
import { Beside } from '../Feed/Beside'
import { FeedFiltersControl } from '../Feed/FeedFiltersControl'
import { FeedSwitcher } from '../Feed/FeedSwitcher/FeedSwitcher'
import { Row1 } from '../Feed/Row1'
import { Row2 } from '../Feed/Row2'
import { Row3 } from '../Feed/Row3'
import { FullTopic } from '../Topic/Full'

interface Props {
  topic: Topic
  shouts: Shout[]
  topicSlug: string
  followers?: Author[]
}

export const PRERENDERED_ARTICLES_COUNT = 28
const AUTHORS_PER_PAGE = 20

// Добавим тип для статистики топика
type TopicStats = {
  shouts: number
  authors: number
  followers?: number
}

type TopicTab = 'shouts' | 'authors' | 'about'

export const TopicView = (props: Props) => {
  const { t } = useLocalize()
  const loc = useLocation()
  const params = useParams()
  const { feedByTopic, mode: feedMode, filterState, options } = useFeed()
  const { topicEntities } = useTopics()

  // Состояние для управления табами
  const [currentTab, setCurrentTab] = createSignal<TopicTab | undefined>()

  // 1. Обновим сигналы и добавим эффект для начальных данных
  const [sortedFeed, setSortedFeed] = createSignal<Shout[]>(props.shouts || [])
  const [loadMoreHidden, setLoadMoreHidden] = createSignal(false)
  const [topic, setTopic] = createSignal<Topic>(props.topic) // Инициализируем сразу с данными из пропсов

  // Сигналы для авторов топика с пагинацией
  const [topicAuthorsList, setTopicAuthorsList] = createSignal<Author[]>([])
  const [loadMoreAuthorsHidden, setLoadMoreAuthorsHidden] = createSignal(false)

  // Эффект для обновления топика из контекста, но только если он еще не установлен или изменился
  createEffect(
    on(topicEntities, (ttt: Record<string, Topic>) => {
      const contextTopic = ttt[props.topicSlug]
      const currentTopic = topic()

      // Обновляем только если топик из контекста более актуальный (имеет статистику)
      if (contextTopic && (!currentTopic || !currentTopic.stat || contextTopic.stat)) {
        setTopic(contextTopic)
      }
    })
  )

  // Мемо для статистики топика
  const stats = createMemo<TopicStats>(() => {
    const topicData = topic()
    const result = {
      shouts: topicData?.stat?.shouts ?? 0,
      authors: topicData?.stat?.authors ?? 0,
      followers: topicData?.stat?.followers ?? 0
    }
    return result
  })

  // 2. Добавим эффект для обработки начальных данных
  createEffect(() => {
    if (props.shouts?.length) {
      setSortedFeed(props.shouts)
      setLoadMoreHidden(props.shouts.length < FEED_PAGE_SIZE)
    }
  })

  // 3. Обновим эффект для отслеживания изменений в feed
  createEffect(
    on(
      () => feedByTopic()[props.topicSlug],
      (topicFeed) => {
        if (topicFeed?.length) {
          console.debug('Feed updated:', topicFeed.length, 'articles')
          setSortedFeed(topicFeed)
          setLoadMoreHidden(topicFeed.length === stats().shouts)
        }
      },
      { defer: false } // Важно: убираем defer чтобы эффект сработал сразу
    )
  )

  // 4. Добавим эффект для сброса при смене топика
  createEffect(
    on(
      () => props.topicSlug,
      (newSlug, prevSlug) => {
        if (newSlug !== prevSlug) {
          setSortedFeed([]) // Сбрасываем при смене топика
          setTopicAuthorsList([]) // Сбрасываем авторов при смене топика
          setLoadMoreAuthorsHidden(false)
        }
      }
    )
  )

  // Обновляем эффект для корректной обработки URL и состояния
  createEffect(
    on(
      () => [loc.pathname, params.tab, feedMode()],
      ([pathname]) => {
        if (pathname.includes('/authors')) {
          setCurrentTab('authors')
          // Загружаем авторов если их еще нет
          if (!topicAuthorsList().length && topic()) {
            void loadTopicAuthorsWithPagination(0).then((result) => {
              if (result.length) {
                setTopicAuthorsList(result)
                setLoadMoreAuthorsHidden(result.length >= stats().authors)
              }
            })
          }
        } else if (pathname.includes('/about')) {
          setCurrentTab('about')
        } else {
          setCurrentTab(undefined)
        }
      },
      { defer: false }
    )
  )

  // Loading Followers and Authors for the topics

  const getTopicFollowers = async () => {
    const topicFollowers = await loadTopicFollowers({ slug: props.topicSlug })()
    // sorting by maximum shouts
    if (topicFollowers) {
      return topicFollowers.sort((a: Author, b: Author) => (b.stat?.shouts || 0) - (a.stat?.shouts || 0))
    }
    return []
  }
  const [topicFollowers, { refetch: refetchFollowers }] = createResource(() => props.topicSlug, getTopicFollowers)

  // Первая функция для авторов топика (переименована во избежание конфликта)
  const getTopicAuthorsList = async () => {
    const topicAuthors = await loadTopicAuthors({ slug: props.topicSlug })()
    // sorting by maximum shouts
    if (topicAuthors) {
      return topicAuthors.sort((a: Author, b: Author) => (b.stat?.shouts || 0) - (a.stat?.shouts || 0))
    }
    return []
  }
  const [topicAuthors, { refetch: refetchAuthors }] = createResource(() => props.topicSlug, getTopicAuthorsList)

  // Функция для загрузки авторов с пагинацией
  const loadTopicAuthorsWithPagination = async (offset = 0): Promise<Author[]> => {
    try {
      console.log('[TopicView] Loading topic authors with pagination:', {
        topic: props.topicSlug,
        offset
      })

      const by: AuthorsBy = { topic: props.topicSlug }
      const authorsFetcher = loadAuthors({ by, limit: AUTHORS_PER_PAGE, offset })
      const result = await authorsFetcher()

      if (result?.length) {
        return result.sort((a: Author, b: Author) => (b.stat?.shouts || 0) - (a.stat?.shouts || 0))
      }
      return []
    } catch (error) {
      console.error('[TopicView] Error loading topic authors:', error)
      return []
    }
  }

  // Вторая функция для топ-авторов (переименована для ясности)
  const getTopicTopAuthors = async () => {
    const by: AuthorsBy = { topic: props.topicSlug }
    const topicTopAuthorsFetcher = await loadAuthors({ by, limit: 4, offset: 0 })
    const result = await topicTopAuthorsFetcher()
    return result || []
  }
  const [topicTopAuthors, { refetch: refetchTopAuthors }] = createResource(() => props.topicSlug, getTopicTopAuthors)

  // Load Favorite and Reacted Top Month Articles
  const loadFavoriteTopArticles = async () => {
    const options: LoadShoutsOptions = {
      filters: { featured: true, topic: props.topicSlug },
      limit: 10,
      random_limit: 100
    }
    const topicRandomShoutsFetcher = loadShouts({ options })
    const result = await topicRandomShoutsFetcher()
    return result || []
  }
  const [favoriteTopArticles, { refetch: refetchFavoriteArticles }] = createResource(
    () => props.topicSlug,
    loadFavoriteTopArticles
  )

  const loadReactedTopMonthArticles = async () => {
    const now = new Date()
    const after = getUnixtime(new Date(now.setMonth(now.getMonth() - 1)))

    const options: LoadShoutsOptions = {
      filters: { after: after, featured: true, topic: props.topicSlug },
      limit: 10,
      random_limit: 10
    }

    const reactedTopMonthShoutsFetcher = loadShouts({ options })
    const result = await reactedTopMonthShoutsFetcher()
    return result || []
  }
  const [reactedTopMonthArticles, { refetch: refetchReactedArticles }] = createResource(
    () => props.topicSlug,
    loadReactedTopMonthArticles
  )

  createEffect(
    on(
      () => props.topicSlug,
      (slug) => {
        if (slug) {
          refetchFollowers()
          refetchAuthors()
          refetchTopAuthors()
          refetchFavoriteArticles()
          refetchReactedArticles()
        }
      }
    )
  )

  // Функция загрузки публикаций топика с учетом фильтров
  const loadTopicShouts = async (offset = 0) => {
    if (!topic()) return []

    try {
      console.log('[TopicView] Loading topic shouts with filters:', {
        topic: topic()?.slug,
        filters: filterState().filters,
        options: options(),
        offset
      })

      // Объединяем фильтр топика с другими фильтрами и опциями
      const currentFilters = filterState().filters
      const currentOptions = options()
      const mergedFilters = {
        ...currentFilters,
        topic: topic()!.slug
      }

      const topicShoutsFetcher = loadShouts({
        options: {
          ...currentOptions,
          filters: mergedFilters,
          limit: FEED_PAGE_SIZE,
          offset
        }
      })
      const result = await topicShoutsFetcher()

      if (result?.length) {
        return result
      }
      return []
    } catch (error) {
      console.error('[TopicView] Error loading topic shouts:', error)
      return []
    }
  }

  // Эффект для перезагрузки публикаций топика при изменении фильтров
  createEffect(
    on(
      () => filterState().timestamp,
      (timestamp, prevTimestamp) => {
        // Перезагружаем только если фильтры действительно изменились и топик загружен
        if (timestamp !== prevTimestamp && prevTimestamp !== undefined && topic() && !currentTab()) {
          console.log('[TopicView] Filters changed, reloading topic feed:', topic()?.slug)

          // Сбрасываем текущие данные и загружаем заново
          setSortedFeed([])
          setLoadMoreHidden(false)

          void loadTopicShouts(0).then((result) => {
            if (result.length) {
              setSortedFeed(result)
              setLoadMoreHidden(result.length < FEED_PAGE_SIZE)
            } else {
              setLoadMoreHidden(true)
            }
          })
        }
      },
      { defer: true }
    )
  )

  // 5. Обновим loadMore для гарантированного обновления UI
  const loadMore = async () => {
    saveScrollPosition()
    const currentLength = sortedFeed().length

    const result = await loadTopicShouts(currentLength)
    if (result?.length) {
      batch(() => {
        setSortedFeed((prev) => [...prev, ...result])
        setLoadMoreHidden(sortedFeed().length + result.length === stats().shouts)
      })
    }
    restoreScrollPosition()
    return result as LoadMoreItems
  }

  // Функция загрузки дополнительных авторов
  const loadMoreAuthors = async () => {
    saveScrollPosition()
    try {
      console.log('[TopicView] Loading more authors for topic:', props.topicSlug, 'offset:', topicAuthorsList().length)
      const result = await loadTopicAuthorsWithPagination(topicAuthorsList().length)

      if (result?.length) {
        console.log('[TopicView] Loaded more authors:', result.length)

        setTopicAuthorsList((prev) => [...prev, ...result])
        setLoadMoreAuthorsHidden(topicAuthorsList().length >= stats().authors)
      }

      restoreScrollPosition()
      return result as LoadMoreItems
    } catch (error) {
      console.error('[TopicView] Error loading more authors:', error)
      return []
    }
  }

  // Компонент навигации по табам
  const TabNavigator = () => (
    <div class={styles.tabNavigator}>
      <ul class="view-switcher">
        <li classList={{ 'view-switcher__item--selected': !currentTab() }}>
          <A href={`/topic/${props.topicSlug}`}>{t('Publications')}</A>
          <Show when={topic() && stats().shouts > 0}>
            <span class="view-switcher__counter">{stats().shouts}</span>
          </Show>
        </li>
        <li classList={{ 'view-switcher__item--selected': currentTab() === 'authors' }}>
          <A href={`/topic/${props.topicSlug}/authors`}>{t('Authors')}</A>
          <Show when={topic() && stats().authors > 0}>
            <span class="view-switcher__counter">{stats().authors}</span>
          </Show>
        </li>
        <li classList={{ 'view-switcher__item--selected': currentTab() === 'about' }}>
          <A href={`/topic/${props.topicSlug}/about`}>{t('About')}</A>
        </li>
      </ul>
    </div>
  )

  // Add an effect to update loadMoreHidden when topic stats change:
  createEffect(
    on(
      () => stats().shouts,
      (totalShouts) => {
        if (totalShouts > 0) {
          setLoadMoreHidden(sortedFeed().length >= totalShouts)
        }
      }
    )
  )

  // Effect: Reset sortedFeed When Topic Slug Changes
  createEffect(
    on(
      () => [props.topicSlug, props.shouts, props.topic] as const,
      ([newSlug, newShouts, newTopic], prevValues) => {
        const prevSlug = prevValues?.[0]
        if (newSlug !== prevSlug) {
          // Сбрасываем и сразу устанавливаем начальные данные для нового топика
          const initialShouts = newShouts || []
          setSortedFeed(initialShouts)
          setLoadMoreHidden(initialShouts.length < FEED_PAGE_SIZE)

          // Сбрасываем данные авторов для нового топика
          setTopicAuthorsList([])
          setLoadMoreAuthorsHidden(false)

          // Обновляем топик из пропсов
          if (newTopic) {
            setTopic(newTopic)
          }
        }
      },
      { defer: true }
    )
  )

  // Добавляем сигналы для кэширования
  const [prevFeed, setPrevFeed] = createSignal<Shout[]>([])
  const [prevSorted, setPrevSorted] = createSignal<Shout[]>([])

  const topicFeed = () => feedByTopic()?.[props.topicSlug] || []

  const topViewedShouts = createMemo(() => {
    const feed = topicFeed()

    const isEqual = feed.length === prevFeed().length && feed.every((item, i) => item.id === prevFeed()[i]?.id)

    if (isEqual) return prevSorted()

    setPrevFeed(feed)
    const sorted = [...feed].sort((a: Shout, b: Shout) => {
      const aViews = (a.stat as Stat)?.viewed || 0
      const bViews = (b.stat as Stat)?.viewed || 0
      return bViews - aViews
    })
    setPrevSorted(sorted)

    return sorted
  })

  // Система дедупликации для предотвращения повторов публикаций
  const dedupContext = new FeedDeduplicationContext()

  // Мемоизированные дедуплицированные блоки
  const deduplicatedBlocks = createMemo(() => {
    // Очищаем контекст при каждом пересчете
    dedupContext.clear()

    const feedData = sortedFeed() || []
    const topViewed = topViewedShouts()
    const reactedArticles = reactedTopMonthArticles() || []
    const favoriteArticles = favoriteTopArticles() || []

    // Основная лента - приоритет для первых статей
    const mainFeedFirst = feedData.slice(0, 8) // Row1 + Row2 + Beside + Row2 + Row1
    dedupContext.addUsedShouts(mainFeedFirst)

    // Дедуплицируем дополнительные блоки
    const deduplicatedReacted = dedupContext.filterUnused(reactedArticles)
    const deduplicatedFavorite = dedupContext.filterUnused(favoriteArticles)
    const deduplicatedTopViewed = dedupContext.filterUnused(topViewed.slice(0, 5))

    // Добавляем использованные из дополнительных блоков
    dedupContext.addUsedShouts(deduplicatedReacted.slice(0, 10)) // Лимитируем слайдер
    dedupContext.addUsedShouts(deduplicatedFavorite.slice(0, 10)) // Лимитируем слайдер
    dedupContext.addUsedShouts(deduplicatedTopViewed)

    // Остальная лента (после первых 8)
    const remainingFeed = dedupContext.filterUnused(feedData.slice(8))

    return {
      mainFeedFirst,
      remainingFeed,
      topViewed: deduplicatedTopViewed,
      reactedArticles: deduplicatedReacted,
      favoriteArticles: deduplicatedFavorite
    }
  })

  return (
    <div class={styles.topicPage}>
      <Suspense fallback={<Loading />}>
        <FullTopic topic={topic()} followers={topicFollowers()} authors={topicAuthors()} />

        <div class="wide-container">
          <div class={clsx(styles.groupControls, 'row')}>
            <div class="col-md-24">
              <div class={styles.controlsRow}>
                <TabNavigator />
              </div>

              {/* Центральный блок с фильтрами - показываем только на вкладке публикаций */}
              <div class={styles.filtersInline}>
                <Show when={currentTab() === 'shouts'}>
                  <FeedSwitcher
                    options={['recent', 'top', 'hot']}
                    prefix={`/topic/${props.topicSlug}`}
                    class={styles.feedSwitcher}
                  />
                  <FeedFiltersControl />
                </Show>
              </div>
            </div>
          </div>
        </div>

        <Switch>
          <Match when={currentTab() === 'about'}>
            <div class="wide-container">
              <div class="row">
                <div class="col-md-20 col-lg-18">
                  <Show when={topic()?.body} fallback={<div>{t('No information provided')}</div>}>
                    <div innerHTML={topic()?.body || ''} />
                  </Show>
                </div>
              </div>
            </div>
          </Match>

          <Match when={currentTab() === 'authors'}>
            {/* Показываем авторов если статистика показывает больше 0 */}
            <Show when={stats().authors > 0}>
              <Show
                when={topicAuthorsList().length > 0}
                fallback={
                  <div class="wide-container">
                    <div class="row">
                      <div class="col-md-20 col-lg-18">
                        <div style="text-align: center; padding: 4rem 2rem;">
                          <Show when={topic()?.slug} fallback={<Loading />}>
                            <div>
                              <h3 style="margin-bottom: 1rem; color: #666;">{t('No authors found')}</h3>
                              <p style="color: #999;">{t('Try changing filters or check back later')}</p>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              >
                <LoadMoreWrapper
                  loadFunction={loadMoreAuthors}
                  pageSize={AUTHORS_PER_PAGE}
                  hidden={loadMoreAuthorsHidden()}
                >
                  <div class="wide-container">
                    <div class="row">
                      <div class="col-md-20 col-lg-18">
                        <div
                          class="authors-grid"
                          style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem; padding: 2rem 0;"
                        >
                          <For each={topicAuthorsList()}>
                            {(author) => <AuthorCard author={author} followers={[]} flatFollows={[]} />}
                          </For>
                        </div>
                      </div>
                    </div>
                  </div>
                </LoadMoreWrapper>
              </Show>
            </Show>
          </Match>

          <Match when={!currentTab()}>
            {/* Показываем публикации если статистика показывает больше 0 */}
            <Show when={stats().shouts > 0}>
              <Show
                when={sortedFeed().length > 0}
                fallback={
                  <div class="wide-container">
                    <div class="row">
                      <div class="col-md-20 col-lg-18">
                        <div style="text-align: center; padding: 4rem 2rem;">
                          <Show when={topic()?.slug} fallback={<Loading />}>
                            <div>
                              <h3 style="margin-bottom: 1rem; color: #666;">{t('No publications found')}</h3>
                              <p style="color: #999;">{t('Try changing filters or check back later')}</p>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              >
                {/* Основные блоки с приоритетными публикациями */}
                <Show when={deduplicatedBlocks().mainFeedFirst[0]}>
                  <Row1 article={deduplicatedBlocks().mainFeedFirst[0]} />
                </Show>

                <Show when={deduplicatedBlocks().mainFeedFirst.slice(1, 3).length > 0}>
                  <Row2 articles={deduplicatedBlocks().mainFeedFirst.slice(1, 3)} isEqual={true} />
                </Show>

                <Show when={deduplicatedBlocks().mainFeedFirst[3]}>
                  <Beside
                    beside={deduplicatedBlocks().mainFeedFirst[3]}
                    title={t('Topic is supported by')}
                    values={topicTopAuthors() || []}
                    wrapper={'author'}
                  />
                </Show>

                {/* Дедуплицированный блок "Top month" */}
                <Show when={deduplicatedBlocks().reactedArticles.length > 0} keyed={true}>
                  <ArticleCardSwiper
                    title={t('Top month')}
                    slides={deduplicatedBlocks().reactedArticles.slice(0, 10)}
                  />
                </Show>

                {/* Дедуплицированный блок "Top viewed" */}
                <Show when={deduplicatedBlocks().mainFeedFirst[4]}>
                  <Beside
                    beside={deduplicatedBlocks().mainFeedFirst[4]}
                    title={t('Top viewed')}
                    values={deduplicatedBlocks().topViewed}
                    wrapper={'top-article'}
                  />
                </Show>

                <Show when={deduplicatedBlocks().mainFeedFirst.slice(5, 7).length > 0}>
                  <Row2 articles={deduplicatedBlocks().mainFeedFirst.slice(5, 7)} isEqual={true} />
                </Show>

                <Show when={deduplicatedBlocks().mainFeedFirst[7]}>
                  <Row1 article={deduplicatedBlocks().mainFeedFirst[7]} />
                </Show>

                {/* Дедуплицированный блок "Favorite" */}
                <Show when={deduplicatedBlocks().favoriteArticles.length > 0} keyed={true}>
                  <ArticleCardSwiper
                    title={t('Favorite')}
                    slides={deduplicatedBlocks().favoriteArticles.slice(0, 10)}
                  />
                </Show>

                {/* Оставшиеся публикации (дедуплицированные) */}
                <Show when={deduplicatedBlocks().remainingFeed.length > 0}>
                  <Row3 articles={deduplicatedBlocks().remainingFeed.slice(0, 3)} />
                  <Row2 articles={deduplicatedBlocks().remainingFeed.slice(3, 5)} />
                </Show>

                <LoadMoreWrapper loadFunction={loadMore} pageSize={FEED_PAGE_SIZE} hidden={loadMoreHidden()}>
                  <For each={deduplicatedBlocks().remainingFeed}>
                    {(_article, index) => {
                      const i = index()
                      // Начинаем с 5 (пропускаем уже отображенные выше)
                      const adjustedIndex = i + 5
                      if (adjustedIndex % 3 === 0) {
                        const articles = deduplicatedBlocks().remainingFeed.slice(adjustedIndex, adjustedIndex + 3)
                        return (
                          <Switch>
                            <Match when={articles.length === 1}>
                              <Row1 article={articles[0]} noauthor={false} nodate={true} />
                            </Match>
                            <Match when={articles.length === 2}>
                              <Row2 articles={articles} noauthor={false} nodate={true} isEqual={true} />
                            </Match>
                            <Match when={articles.length === 3}>
                              <Row3 articles={articles} noauthor={false} nodate={true} />
                            </Match>
                          </Switch>
                        )
                      }
                      return null
                    }}
                  </For>
                </LoadMoreWrapper>
              </Show>
            </Show>
          </Match>
        </Switch>
      </Suspense>
    </div>
  )
}
