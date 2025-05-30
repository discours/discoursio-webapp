// import { useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import {
  For,
  Match,
  Show,
  Suspense,
  Switch,
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on
} from 'solid-js'
import { FEED_PAGE_SIZE, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { loadAuthors, loadShouts, loadTopicAuthors, loadTopicFollowers } from '~/graphql/api/public'
import { Author, AuthorsBy, LoadShoutsOptions, Shout, Stat, Topic } from '~/graphql/schema/core.gen'
import { getUnixtime } from '~/lib/fromPeriod'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { Beside } from '../Feed/Beside'
import { FeedFiltersControl } from '../Feed/FeedFiltersControl'
import { FeedSwitcher } from '../Feed/FeedSwitcher/FeedSwitcher'
import { Row1 } from '../Feed/Row1'
import { Row2 } from '../Feed/Row2'
import { Row3 } from '../Feed/Row3'
import { FullTopic } from '../Topic/Full'
import { LoadMoreItems, LoadMoreWrapper } from '../_shared/LoadMoreWrapper'
import { Loading } from '../_shared/Loading'
import { ArticleCardSwiper } from '../_shared/SolidSwiper/ArticleCardSwiper'

import styles from '~/styles/views/Topic.module.scss'

interface Props {
  topic: Topic
  shouts: Shout[]
  topicSlug: string
  followers?: Author[]
}

export const PRERENDERED_ARTICLES_COUNT = 28
// const LOAD_MORE_PAGE_SIZE = 9 // Row3 + Row3 + Row3

export const TopicView = (props: Props) => {
  const { t } = useLocalize()
  const { feedByTopic } = useFeed()
  const { topicEntities } = useTopics()

  // 1. Обновим сигналы и добавим эффект для начальных данных
  const [sortedFeed, setSortedFeed] = createSignal<Shout[]>(props.shouts || [])
  const [loadMoreHidden, setLoadMoreHidden] = createSignal(false)
  const [topic, setTopic] = createSignal<Topic>()
  createEffect(on(topicEntities, (ttt: Record<string, Topic>) => setTopic(ttt[props.topicSlug])))

  // 2. Добавим эффект для обработки начальных данных
  createEffect(() => {
    if (props.shouts?.length) {
      setSortedFeed(props.shouts)
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

          setLoadMoreHidden(topicFeed.length === (topic()?.stat?.shouts || 0))
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
        }
      }
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
  const [topicFollowers, { refetch: refetchFollowers }] = createResource(
    () => props.topicSlug,
    getTopicFollowers
  )

  // Первая функция для авторов топика (переименована во избежание конфликта)
  const getTopicAuthorsList = async () => {
    const topicAuthors = await loadTopicAuthors({ slug: props.topicSlug })()
    // sorting by maximum shouts
    if (topicAuthors) {
      return topicAuthors.sort((a: Author, b: Author) => (b.stat?.shouts || 0) - (a.stat?.shouts || 0))
    }
    return []
  }
  const [topicAuthors, { refetch: refetchAuthors }] = createResource(
    () => props.topicSlug,
    getTopicAuthorsList
  )

  // Вторая функция для топ-авторов (переименована для ясности)
  const getTopicTopAuthors = async () => {
    const by: AuthorsBy = { topic: props.topicSlug }
    const topicTopAuthorsFetcher = await loadAuthors({ by, limit: 4, offset: 0 })
    const result = await topicTopAuthorsFetcher()
    return result || []
  }
  const [topicTopAuthors, { refetch: refetchTopAuthors }] = createResource(
    () => props.topicSlug,
    getTopicTopAuthors
  )

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

  // 5. Обновим loadMore для гарантированного обновления UI
  const loadMore = async () => {
    saveScrollPosition()
    const currentLength = sortedFeed().length

    const topicShoutsFetcher = loadShouts({
      options: {
        filters: { topic: props.topicSlug },
        limit: FEED_PAGE_SIZE,
        offset: currentLength
      }
    })

    const result = await topicShoutsFetcher()
    if (result?.length) {
      batch(() => {
        setSortedFeed((prev) => [...prev, ...result])
        setLoadMoreHidden(sortedFeed().length + result.length === (topic()?.stat?.shouts || 0))
      })
    }
    restoreScrollPosition()
    return result as LoadMoreItems
  }

  // Добавляем сигналы для кэширования
  const [prevFeed, setPrevFeed] = createSignal<Shout[]>([])
  const [prevSorted, setPrevSorted] = createSignal<Shout[]>([])

  const topicFeed = () => feedByTopic()?.[props.topicSlug] || []

  const topViewedShouts = createMemo(() => {
    const feed = topicFeed()

    const isEqual =
      feed.length === prevFeed().length && feed.every((item, i) => item.id === prevFeed()[i]?.id)

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

  return (
    <div class={styles.topicPage}>
      <Suspense fallback={<Loading />}>
        <FullTopic topic={topic() as Topic} followers={topicFollowers()} authors={topicAuthors()} />

        <div class="wide-container">
          <div class={clsx(styles.groupControls, 'row')}>
            <div class={styles.filtersRow}>
              <FeedSwitcher
                options={['recent', 'top', 'hot']}
                prefix={`/topic/${props.topicSlug}`}
                class={styles.feedSwitcher}
              />
              <FeedFiltersControl />
            </div>
          </div>
        </div>

        <Row1 article={(sortedFeed() || [])[0]} />
        <Row2 articles={(sortedFeed() || []).slice(1, 3)} isEqual={true} />

        {/* Bisede for adding top authors by Slug */}

        <Beside
          beside={(sortedFeed() || [])[3]}
          title={t('Topic is supported by')}
          values={topicTopAuthors() || []}
          wrapper={'author'}
        />

        <Show when={(reactedTopMonthArticles()?.length ?? 0) > 0} keyed={true}>
          <ArticleCardSwiper title={t('Top month')} slides={reactedTopMonthArticles() || []} />
        </Show>

        <Beside
          beside={(sortedFeed() || [])[4]}
          title={t('Top viewed')}
          values={topViewedShouts().slice(0, 5)}
          wrapper={'top-article'}
        />

        <Row2 articles={(sortedFeed() || []).slice(5, 7)} isEqual={true} />
        <Row1 article={(sortedFeed() || [])[7]} />

        <Show when={favoriteTopArticles()?.length ?? 0} keyed={true}>
          <ArticleCardSwiper title={t('Favorite')} slides={favoriteTopArticles() || []} />
        </Show>

        <Show when={(sortedFeed() || []).length > 7}>
          <Row3 articles={(sortedFeed() || []).slice(8, 11)} />
          <Row2 articles={(sortedFeed() || []).slice(11, 13)} />
        </Show>

        <LoadMoreWrapper loadFunction={loadMore} pageSize={FEED_PAGE_SIZE} hidden={loadMoreHidden()}>
          <For each={sortedFeed()}>
            {(_article, index) => {
              const i = index()
              if (i % 3 === 0) {
                const articles = sortedFeed().slice(i, i + 3)
                return (
                  <Switch>
                    <Match when={articles.length === 1}>
                      <Row1 article={articles[0]} noauthor={true} nodate={true} />
                    </Match>
                    <Match when={articles.length === 2}>
                      <Row2 articles={articles} noauthor={true} nodate={true} isEqual={true} />
                    </Match>
                    <Match when={articles.length === 3}>
                      <Row3 articles={articles} noauthor={true} nodate={true} />
                    </Match>
                  </Switch>
                )
              }
              return null
            }}
          </For>
        </LoadMoreWrapper>
      </Suspense>
    </div>
  )
}
