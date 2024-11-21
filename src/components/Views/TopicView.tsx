// import { useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Match, Show, Suspense, Switch, createEffect, createMemo, createSignal, on } from 'solid-js'
import { FEED_PAGE_SIZE, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { getAuthorsByTopic, getFollowersByTopic, loadShouts } from '~/graphql/api/public'
import { Author, LoadShoutsOptions, Shout, Topic } from '~/graphql/schema/core.gen'
import { getUnixtime } from '~/utils/date'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { byPublished, byStat } from '~/utils/sort'
import { Beside } from '../Feed/Beside'
import { Row1 } from '../Feed/Row1'
import { Row2 } from '../Feed/Row2'
import { Row3 } from '../Feed/Row3'
import { FullTopic } from '../Topic/Full'
import { LoadMoreItems, LoadMoreWrapper } from '../_shared/LoadMoreWrapper'
import { Loading } from '../_shared/Loading'
import { ArticleCardSwiper } from '../_shared/SolidSwiper/ArticleCardSwiper'

import styles from '~/styles/views/Topic.module.scss'
import { FeedFilters } from '../Feed/FeedFilters'
import { FeedSwitcher } from '../Feed/FeedSwitcher/FeedSwitcher'

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
  const [favoriteTopArticles, setFavoriteTopArticles] = createSignal<Shout[]>([])
  const [reactedTopMonthArticles, setReactedTopMonthArticles] = createSignal<Shout[]>([])
  const [followers, setFollowers] = createSignal<Author[]>(props.followers || [])

  // 1. Обновим сигналы и добавим эффект для начальных данных
  const [sortedFeed, setSortedFeed] = createSignal<Shout[]>(props.shouts || [])
  const [loadMoreHidden, setLoadMoreHidden] = createSignal(false)
  const [topic, setTopic] = createSignal<Topic>()
  createEffect(on(topicEntities, (ttt) => setTopic(ttt[props.topicSlug])))

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

  const loadTopicFollowers = async () => {
    const topicFollowersFetcher = getFollowersByTopic(props.topicSlug)
    const topicFollowers = await topicFollowersFetcher()
    topicFollowers && setFollowers(topicFollowers)
    console.debug('loadTopicFollowers', topicFollowers)
  }

  const [topicAuthors, setTopicAuthors] = createSignal<Author[]>([])
  const loadTopicAuthors = async () => {
    const topicAuthorsFetcher = getAuthorsByTopic(props.topicSlug)
    const topicAuthors = await topicAuthorsFetcher()
    topicAuthors && setTopicAuthors(topicAuthors)
    console.debug('loadTopicAuthors got ', topicAuthors?.length, 'authors')
  }

  const loadFavoriteTopArticles = async () => {
    const options: LoadShoutsOptions = {
      filters: { featured: true, topic: props.topicSlug },
      limit: 10,
      random_limit: 100
    }
    const topicRandomShoutsFetcher = loadShouts({ options })
    const result = await topicRandomShoutsFetcher()
    result && setFavoriteTopArticles(result)
    console.debug('loadFavoriteTopArticles', result)
  }

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
    result && setReactedTopMonthArticles(result)
    console.debug('loadReactedTopMonthArticles', result)
  }

  // второй этап начальной загрузки данных
  createEffect(
    on(
      topic,
      (tpc) => {
        console.debug('topic loaded', tpc)
        if (!tpc) return
        loadFavoriteTopArticles()
        loadReactedTopMonthArticles()
        loadTopicAuthors()
        loadTopicFollowers()
      },
      { defer: true }
    )
  )

  // 5. Обновим loadMore для гарантированного обновления UI
  const loadMore = async () => {
    saveScrollPosition()
    const topicShoutsFetcher = loadShouts({
      options: {
        filters: { topic: props.topicSlug },
        limit: FEED_PAGE_SIZE,
        offset: sortedFeed().length
      }
    })

    const result = await topicShoutsFetcher()
    if (result?.length) {
      setSortedFeed((prev) => [...prev, ...result]) // Напрямую обновляем sortedFeed
    }
    restoreScrollPosition()
    return result as LoadMoreItems
  }

  const topViewedShouts = createMemo(() => {
    const loaded = feedByTopic()?.[props.topicSlug] || []
    const sss = [...loaded] as Shout[]
    const sortfn = byStat('views') || byPublished
    sortfn && sss.sort(sortfn as ((a: Shout, b: Shout) => number) | undefined)
    return sss
  })

  return (
    <div class={styles.topicPage}>
      <Suspense fallback={<Loading />}>
        <Show when={topic()}>
          <FullTopic topic={topic() as Topic} followers={followers()} authors={topicAuthors()} />
        </Show>
        <div class="wide-container">
          <div class={clsx(styles.groupControls, 'row')}>
            <div class="col-md-12">
              <div class={styles.filtersRow}>
                <FeedSwitcher
                  options={['recent', 'top', 'hot']}
                  prefix={`/topic/${props.topicSlug}`}
                  class={styles.feedSwitcher}
                />
                <FeedFilters />
              </div>
            </div>
          </div>
        </div>

        <Row1 article={(sortedFeed() || [])[0]} />
        <Row2 articles={(sortedFeed() || []).slice(1, 3)} isEqual={true} />

        <Beside
          beside={(sortedFeed() || [])[3]}
          title={t('Topic is supported by')}
          values={topicAuthors() || []}
          wrapper={'author'}
        />
        <Show when={reactedTopMonthArticles()?.length > 0} keyed={true}>
          <ArticleCardSwiper title={t('Top month')} slides={reactedTopMonthArticles()} />
        </Show>
        <Beside
          beside={(sortedFeed() || [])[4]}
          title={t('Top viewed')}
          values={topViewedShouts().slice(0, 5)}
          wrapper={'top-article'}
        />

        <Row2 articles={(sortedFeed() || []).slice(5, 7)} isEqual={true} />
        <Row1 article={(sortedFeed() || [])[7]} />

        <Show when={favoriteTopArticles()?.length > 0} keyed={true}>
          <ArticleCardSwiper title={t('Favorite')} slides={favoriteTopArticles()} />
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
