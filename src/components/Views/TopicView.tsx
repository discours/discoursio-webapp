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

import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { Loading } from '../_shared/Loading'
import { LoadMoreItems, LoadMoreWrapper } from '../_shared/LoadMoreWrapper'
import { SearchField } from '../_shared/SearchField'
import { ArticleCardSwiper } from '../_shared/SolidSwiper/ArticleCardSwiper'

import { Beside } from '../Feed/Beside'
import { FeedFiltersControl } from '../Feed/FeedFiltersControl'
import { FeedSwitcher } from '../Feed/FeedSwitcher/FeedSwitcher'
import { Row1 } from '../Feed/Row1'
import { Row2 } from '../Feed/Row2'
import { Row3 } from '../Feed/Row3'
import { FullTopic } from '../Topic/Full'
import { TopicAuthorsView } from './TopicAuthorsView'

interface Props {
  topic: Topic
  shouts: Shout[]
  topicSlug: string
  followers?: Author[]
}

export const PRERENDERED_ARTICLES_COUNT = 28

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
  const { feedByTopic, mode: feedMode, filterState, options, initializeFeed } = useFeed()
  const { topicEntities } = useTopics()

  // Состояние для управления табами
  const [currentTab, setCurrentTab] = createSignal<TopicTab | undefined>()

  // Removed console.log for SSR hydration stability

  // 1. Обновим сигналы и добавим эффект для начальных данных
  const [sortedFeed, setSortedFeed] = createSignal<Shout[]>(props.shouts || [])
  const [loadMoreHidden, setLoadMoreHidden] = createSignal(false)
  const [topic, setTopic] = createSignal<Topic>(props.topic) // Инициализируем сразу с данными из пропсов

  // 🔧 FALLBACK: Если топик не загрузился через route.load, пытаемся найти в контексте
  createEffect(() => {
    if (!props.topic && topicEntities()[props.topicSlug]) {
      setTopic(topicEntities()[props.topicSlug])
    }
  })

  // ✅ ИСПРАВЛЕНИЕ: Единый сигнал для авторов топика (без дублирования)
  const [topicAuthorsList, setTopicAuthorsList] = createSignal<Author[]>(props.followers || [])

  // ⚡ КРИТИЧНО: Обновляем авторов когда приходят новые данные из props
  createEffect(() => {
    if (props.followers && props.followers.length > 0) {
      console.log('[TopicView] Updating authors from props.followers:', props.followers.length)
      setTopicAuthorsList(props.followers)
    }
  })

  // ⚡ ДИАГНОСТИКА: Отслеживаем данные (безопасно для SSR)
  createEffect(() => {
    console.log('[TopicView] Data debug:', {
      shoutsLength: props.shouts?.length || 0,
      followersLength: props.followers?.length || 0,
      topicAuthorsListLength: topicAuthorsList().length,
      currentTab: currentTab(),
      topicTitle: props.topic?.title
    })
  })
  const [searchQuery, setSearchQuery] = createSignal('')

  // ⚡ ПРАВИЛЬНАЯ ЗАГРУЗКА ПО SOLIDJS ПАТТЕРНАМ
  createEffect(
    on(
      () => props.topicSlug,
      (slug) => {
        if (slug) {
          console.log('[TopicView] Loading authors via createEffect for:', slug)
          void loadAuthors({
            by: { topic: slug },
            limit: 20,
            offset: 0
          })().then((authors) => {
            console.log('[TopicView] Authors loaded via createEffect:', authors?.length)
            if (authors?.length) {
              setTopicAuthorsList(authors)
            }
          })
        }
      },
      { defer: false } // ✅ Срабатывает сразу
    )
  )

  // Эффект для обновления топика из контекста, но только если он еще не установлен или изменился
  createEffect(
    on(topicEntities, (ttt: Record<string, Topic>) => {
      const contextTopic = ttt[props.topicSlug]
      const currentTopic = topic()

      // 🔧 ИСПРАВЛЕНИЕ: Обновляем топик из контекста только если:
      // 1. У нас нет текущего топика ИЛИ
      // 2. У текущего топика нет статистики, А у контекстного есть
      if (contextTopic && (!currentTopic || (!currentTopic.stat && contextTopic.stat))) {
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

    // Removed console.log for SSR hydration stability

    return result
  })

  // 2. Добавим эффект для обработки начальных данных
  createEffect(() => {
    if (props.shouts?.length) {
      // 🔧 ИСПРАВЛЕНИЕ: Инициализируем фид в контексте с SSR данными
      initializeFeed(feedMode() || 'recent', props.shouts)

      setSortedFeed(props.shouts)
      setLoadMoreHidden(props.shouts.length < FEED_PAGE_SIZE)

      // ✅ ДИАГНОСТИКА: Проверяем в dev режиме (без console.log для SSR)
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        setTimeout(() => {
          if (sortedFeed().length === 0) {
            console.warn('⚠️ TopicView: sortedFeed is still empty after initialization')
          }
        }, 100)
      }
    } else if (import.meta.env.DEV && typeof window !== 'undefined') {
      // Предупреждаем если нет пропсов с публикациями
      setTimeout(() => {
        console.warn('⚠️ TopicView: No shouts provided in props')
      }, 100)
    }
  })

  // 🔧 ДОПОЛНИТЕЛЬНЫЙ ЭФФЕКТ: Синхронизируем с feedByTopic при изменении
  createEffect(() => {
    const topicFeed = feedByTopic()[props.topicSlug]
    if (topicFeed?.length && sortedFeed().length === 0) {
      console.log('[TopicView] Syncing with feedByTopic:', topicFeed.length)
      setSortedFeed(topicFeed)
      setLoadMoreHidden(topicFeed.length < FEED_PAGE_SIZE)
    }
  })

  // 3. Обновим эффект для отслеживания изменений в feed
  createEffect(
    on(
      () => feedByTopic()[props.topicSlug],
      (topicFeed) => {
        if (topicFeed?.length) {
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
        if (newSlug !== prevSlug && prevSlug !== undefined) {
          // ✅ ИСПРАВЛЕНИЕ: Восстанавливаем фид из пропсов при смене топика
          setSortedFeed(props.shouts || [])
          setTopicAuthorsList([]) // Сбрасываем авторов при смене топика
        }
      }
    )
  )

  // Обновляем эффект для корректной обработки URL и состояния
  createEffect(
    on(
      () => [loc.pathname, params, feedMode()],
      ([pathname, urlParams]) => {
        console.log('[TopicView] URL effect:', pathname, urlParams)
        if (pathname && typeof pathname === 'string' && pathname.includes('/authors')) {
          setCurrentTab('authors')
          // ⚡ ПРЯМОЙ ВЫЗОВ load_authors_by
          console.log('[TopicView] Direct call load_authors_by for:', topic()?.slug)
          if (topic()?.slug) {
            void loadAuthors({
              by: { topic: topic()!.slug },
              limit: 20,
              offset: 0
            })().then((authors) => {
              console.log('[TopicView] Authors loaded:', authors?.length)
              if (authors?.length) {
                setTopicAuthorsList(authors)
              }
            })
          }
        } else if (pathname && typeof pathname === 'string' && pathname.includes('/about')) {
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
      // Loading topic shouts with filters

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
          // Filters changed, reloading topic feed

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

  // Функция загрузки дополнительных авторов - используется в TopicAuthorsView
  const loadMoreAuthors = async (offset: number = topicAuthorsList().length) => {
    console.log(`[TopicView] loadMoreAuthors called with offset: ${offset}, topic: ${props.topicSlug}`)
    try {
      const newAuthors = await loadAuthors({
        by: { topic: props.topicSlug },
        limit: 20,
        offset
      })()

      if (newAuthors?.length) {
        console.log(`[TopicView] Loaded ${newAuthors.length} more authors`)
        // ✅ ИСПРАВЛЕНИЕ: Дедупликация авторов по ID
        setTopicAuthorsList((prev) => {
          const existingIds = new Set(prev.map((author) => author.id))
          const dedupedAuthors = newAuthors.filter((author) => !existingIds.has(author.id))
          return [...prev, ...dedupedAuthors]
        })
        return newAuthors
      }
      return []
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
          <A href={`/topic/${props.topicSlug}/about`}>{t('About topic')}</A>
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
          setLoadMoreHidden(false)

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
      const aViews = (a.stat as Stat)?.views_count || 0
      const bViews = (b.stat as Stat)?.views_count || 0
      return bViews - aViews
    })
    setPrevSorted(sorted)

    return sorted
  })

  // ✅ ПРОСТАЯ ЛОГИКА: Берем статьи как есть
  const mainArticles = createMemo(() => sortedFeed() || [])
  const topViewedArticles = createMemo(() => topViewedShouts().slice(0, 5))
  const reactedArticles = createMemo(() => reactedTopMonthArticles() || [])
  const favoriteArticles = createMemo(() => favoriteTopArticles() || [])

  return (
    <div class={styles.topicPage}>
      <Suspense fallback={<Loading />}>
        <FullTopic topic={topic()} followers={topicFollowers() || []} authors={topicAuthors() || []} />

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

                {/* Поле поиска для вкладки авторов */}
                <Show when={currentTab() === 'authors'}>
                  <div style="width: 100%; margin-top: 16px;">
                    <SearchField onChange={(value) => setSearchQuery(value)} />
                  </div>
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
                  <Show when={topic()?.body} fallback={<div>{t('No description')}</div>}>
                    <div innerHTML={topic()?.body || ''} />
                  </Show>
                </div>
              </div>
            </div>
          </Match>

          <Match when={currentTab() === 'authors'}>
            <Show when={topic()} fallback={<Loading />}>
              <TopicAuthorsView
                topic={topic() as Topic}
                authors={topicAuthorsList()}
                searchQuery={searchQuery()}
                onSearchChange={setSearchQuery}
                onLoadMore={loadMoreAuthors}
              />
            </Show>
          </Match>

          <Match when={!currentTab()}>
            {/* ✅ ИСПРАВЛЕНИЕ: Всегда показываем блок публикаций (с fallback для пустого состояния) */}
            <Show when={true}>
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
                              {/* ✅ ДИАГНОСТИКА: Показываем в dev режиме */}
                              <Show when={import.meta.env.DEV && typeof window !== 'undefined'}>
                                <div style="margin-top: 1rem; padding: 1rem; background: #f0f0f0; border-radius: 4px; font-size: 12px;">
                                  <p>Debug info:</p>
                                  <p>Props shouts: {props.shouts?.length || 0}</p>
                                  <p>Sorted feed: {sortedFeed().length}</p>
                                  <p>Topic stats: {stats().shouts}</p>
                                </div>
                              </Show>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              >
                {/* ✅ ПРОСТАЯ ЛОГИКА: Показываем статьи по порядку */}
                <Show when={mainArticles()[0]}>
                  <Row1 article={mainArticles()[0]} />
                </Show>

                <Show when={mainArticles().slice(1, 3).length > 0}>
                  <Row2 articles={mainArticles().slice(1, 3)} isEqual={true} />
                </Show>

                <Show when={mainArticles()[3]}>
                  <Beside
                    beside={mainArticles()[3]}
                    title={t('Topic is supported by')}
                    values={topicTopAuthors() || []}
                    wrapper={'author'}
                  />
                </Show>

                {/* Top month articles */}
                <Show when={reactedArticles().length > 0}>
                  <ArticleCardSwiper title={t('Top month')} slides={reactedArticles().slice(0, 10)} />
                </Show>

                {/* Top viewed articles */}
                <Show when={mainArticles()[4]}>
                  <Beside
                    beside={mainArticles()[4]}
                    title={t('Top viewed')}
                    values={topViewedArticles()}
                    wrapper={'top-article'}
                  />
                </Show>

                <Show when={mainArticles().slice(5, 7).length > 0}>
                  <Row2 articles={mainArticles().slice(5, 7)} isEqual={true} />
                </Show>

                <Show when={mainArticles()[7]}>
                  <Row1 article={mainArticles()[7]} />
                </Show>

                {/* Favorite articles */}
                <Show when={favoriteArticles().length > 0}>
                  <ArticleCardSwiper title={t('Favorite')} slides={favoriteArticles().slice(0, 10)} />
                </Show>

                {/* ✅ ПРОСТАЯ ЛОГИКА: Остальные статьи с оптимизацией через Row3 */}
                <LoadMoreWrapper loadFunction={loadMore} pageSize={FEED_PAGE_SIZE} hidden={loadMoreHidden()}>
                  <For each={mainArticles().slice(8)}>
                    {(_article, index) => {
                      const i = index()
                      // Группируем статьи по 3 для Row3, оставшиеся по 1 для Row1
                      if (i % 3 === 0) {
                        const articles = mainArticles().slice(8 + i, 8 + i + 3)
                        if (articles.length === 3) {
                          return <Row3 articles={articles} nodate={true} />
                        } else if (articles.length === 2) {
                          return <Row2 articles={articles} isEqual={true} />
                        } else if (articles.length === 1) {
                          return <Row1 article={articles[0]} />
                        }
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
