// import { useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Match, Show, Suspense, Switch, createEffect, createMemo, createSignal, on } from 'solid-js'
import { SHOUTS_PER_PAGE, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { loadAuthors, loadFollowersByTopic, loadShouts } from '~/graphql/api/public'
import { Author, AuthorsBy, LoadShoutsOptions, Shout, Topic } from '~/graphql/schema/core.gen'
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
import { ViewSwitcher } from '../_shared/ViewSwitcher/ViewSwitcher'

export type TopicFeedSortBy = 'comments' | '' | 'recent' | 'viewed' | 'rating' | 'last_comment'

interface Props {
  topic: Topic
  shouts: Shout[]
  topicSlug: string
  followers?: Author[]
  selectedTab?: TopicFeedSortBy
}

export const PRERENDERED_ARTICLES_COUNT = 28
// const LOAD_MORE_PAGE_SIZE = 9 // Row3 + Row3 + Row3

export const TopicView = (props: Props) => {
  const { t } = useLocalize()
  const { feedByTopic, addFeed } = useFeed()
  const { topicEntities } = useTopics()
  // const [searchParams, changeSearchParams] = useSearchParams<{ by: TopicFeedSortBy }>()
  const [favoriteTopArticles, setFavoriteTopArticles] = createSignal<Shout[]>([])
  const [reactedTopMonthArticles, setReactedTopMonthArticles] = createSignal<Shout[]>([])
  const [topic, setTopic] = createSignal<Topic>()
  const [followers, setFollowers] = createSignal<Author[]>(props.followers || [])

  // TODO: filter + sort
  const [sortedFeed, setSortedFeed] = createSignal([] as Shout[])
  createEffect(
    on(
      [feedByTopic, () => props.topicSlug, topicEntities],
      ([feed, slug, ttt]) => {
        if (Object.values(ttt).length === 0) return
        const sss = (feed[slug] || []) as Shout[]
        sss && setSortedFeed(sss)
        console.debug('topic slug loaded', slug)
        const tpc = ttt[slug]
        console.debug('topics loaded', ttt)
        tpc && setTopic(tpc)
      },
      {}
    )
  )

  const loadTopicFollowers = async () => {
    const topicFollowersFetcher = loadFollowersByTopic(props.topicSlug)
    const topicFollowers = await topicFollowersFetcher()
    topicFollowers && setFollowers(topicFollowers)
    console.debug('loadTopicFollowers', topicFollowers)
  }

  const [topicAuthors, setTopicAuthors] = createSignal<Author[]>([])
  const loadTopicAuthors = async () => {
    const by: AuthorsBy = { topic: props.topicSlug }
    const topicAuthorsFetcher = await loadAuthors({ by, limit: 10, offset: 0 })
    const result = await topicAuthorsFetcher()
    result && setTopicAuthors(result)
    console.debug('loadTopicAuthors', result)
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

  // дозагрузка
  const loadMore = async () => {
    saveScrollPosition()
    const amountBefore = feedByTopic()?.[props.topicSlug]?.length || 0
    const topicShoutsFetcher = loadShouts({
      options: { filters: { topic: props.topicSlug }, limit: SHOUTS_PER_PAGE, offset: amountBefore }
    })
    const result = await topicShoutsFetcher()
    result && addFeed(result)
    restoreScrollPosition()
    return result as LoadMoreItems
  }

  /*
  const selectionTitle = createMemo(() => {
    const m = searchParams?.by
    if (m === 'viewed') return t('Top viewed')
    if (m === 'rating') return t('Top rated')
    if (m === 'commented') return t('Top discussed')
    return t('Top recent')
  })
  */

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
                <ViewSwitcher
                  options={['recent', 'top', 'hot']}
                  prefix={`/topic/${props.topicSlug}`}
                  class={styles.viewSwitcher}
                />
                <FeedFilters />
              </div>
            </div>
          </div>
        </div>

        <Row1 article={sortedFeed()[0]} />
        <Row2 articles={sortedFeed().slice(1, 3)} isEqual={true} />

        <Beside
          beside={sortedFeed()[3]}
          title={t('Topic is supported by')}
          values={topicAuthors().slice(0, 6)}
          wrapper={'author'}
        />
        <Show when={reactedTopMonthArticles()?.length > 0} keyed={true}>
          <ArticleCardSwiper title={t('Top month')} slides={reactedTopMonthArticles()} />
        </Show>
        <Beside
          beside={sortedFeed()[4]}
          title={t('Top viewed')}
          values={topViewedShouts().slice(0, 5)}
          wrapper={'top-article'}
        />

        <Row2 articles={sortedFeed().slice(5, 7)} isEqual={true} />
        <Row1 article={sortedFeed()[7]} />

        <Show when={favoriteTopArticles()?.length > 0} keyed={true}>
          <ArticleCardSwiper title={t('Favorite')} slides={favoriteTopArticles()} />
        </Show>

        <Show when={sortedFeed().length > 7}>
          <Row3 articles={sortedFeed().slice(8, 11)} />
          <Row2 articles={sortedFeed().slice(11, 13)} />
        </Show>

        <LoadMoreWrapper loadFunction={loadMore} pageSize={SHOUTS_PER_PAGE}>
          <For
            each={sortedFeed()
              .slice(13)
              .filter((_, i) => i % 3 === 0)}
          >
            {(_shout, index) => {
              const articles = sortedFeed()
                .slice(13)
                .slice(index() * 3, index() * 3 + 3)
              return (
                <>
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
                </>
              )
            }}
          </For>
        </LoadMoreWrapper>
      </Suspense>
    </div>
  )
}
