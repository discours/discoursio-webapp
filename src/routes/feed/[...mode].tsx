import { RouteSectionProps, createAsync, useParams, useSearchParams } from '@solidjs/router'
import { createEffect, on } from 'solid-js'
import { createSignal } from 'solid-js'
import { Suspense } from 'solid-js'

import { FeedView } from '~/components/Views/FeedView'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { FEED_PAGE_SIZE, FeedMode, orderByMode, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { ReactionsProvider } from '~/context/reactions'
import { loadReactions, loadUnratedShouts } from '~/graphql/api/public'
import { loadShouts } from '~/graphql/api/public'
import {
  LoadShoutsFilters,
  LoadShoutsOptions,
  Reaction,
  ReactionKind,
  ReactionSort,
  Shout
} from '~/graphql/schema/core.gen'
import { PeriodType, getFromDate } from '~/lib/fromPeriod'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'

export type FeaturedFilter = 'featured' | 'unfeatured' | 'all'

const fetchRecentComments = () => {
  return loadReactions({
    by: {
      kinds: [ReactionKind.Comment],
      sort: ReactionSort.Newest
    },
    limit: 3
  })
}

export const route = {
  load: async ({ params, location: { query } }: RouteSectionProps<{ articles: Shout[] }>) => {
    const filters: LoadShoutsFilters = {}
    if (query.period) filters.after = getFromDate(query.period as PeriodType)
    const shoutsFetcher = loadShouts({
      options: {
        filters,
        order_by: orderByMode(params.mode as FeedMode),
        limit: FEED_PAGE_SIZE + 1
      }
    })
    const shouts = await shoutsFetcher()
    const recentCommentsFetcher = fetchRecentComments()
    const recentComments = await recentCommentsFetcher()
    const unratedShoutsFetcher = loadUnratedShouts({ limit: 5, offset: 0 })
    const unratedShouts = await unratedShoutsFetcher()
    return {
      shouts,
      recentComments,
      unratedShouts
    }
  }
}

export type FeedPageProps = {
  shouts: Shout[]
  recentComments: Reaction[]
  unratedShouts: Shout[]
}

export type FeedSearchParams = { period?: PeriodType }

export default (props: RouteSectionProps<FeedPageProps>) => {
  const [searchParams] = useSearchParams<FeedSearchParams>()
  const params = useParams<{ mode: string }>()
  const { t } = useLocalize()
  const { options, isFeedLoading, setFeed, updateOptions } = useFeed()
  const [isLoadMoreButtonVisible, setIsLoadMoreButtonVisible] = createSignal(true)

  // everything from address bar to route feed filters
  createEffect(
    on([() => params.mode, () => searchParams.period], ([newMode, newPeriod]) => {
      const opts: LoadShoutsOptions = { ...options() }
      if (newMode) opts.order_by = orderByMode(newMode as FeedMode)
      if (newPeriod) {
        opts.filters = {
          ...(opts.filters || {}),
          after: getFromDate(newPeriod as PeriodType)
        }
      }
      updateOptions(opts)
    })
  )

  // load more shouts
  const loadMoreShouts = async (offset?: number) => {
    if (isFeedLoading()) return []
    try {
      saveScrollPosition()
      const shoutsLoader = loadShouts({ options: { ...options(), offset } })
      const loaded = await shoutsLoader()
      loaded && setFeed((prev?: Shout[]) => [...(prev || []), ...loaded])
      const hasMore = Array.isArray(loaded) && loaded.length > FEED_PAGE_SIZE
      setIsLoadMoreButtonVisible(hasMore)
      restoreScrollPosition()
      return loaded as LoadMoreItems
    } catch (error) {
      console.error('Error loading feed:', error)
      setIsLoadMoreButtonVisible(false)
      return []
    }
  }

  // preload shouts
  const data = createAsync(async () => {
    const shoutsFetcher = loadShouts({ options: options() })
    const shouts = props.data.shouts || (await shoutsFetcher())
    const recentCommentsFetcher = fetchRecentComments()
    const recentComments = props.data.recentComments || (await recentCommentsFetcher())
    const unratedShoutsFetcher = loadUnratedShouts({ limit: 5, offset: 0 })
    const unratedShouts = props.data.unratedShouts || (await unratedShoutsFetcher())
    shouts && setFeed(shouts)
    return {
      shouts,
      recentComments,
      unratedShouts
    }
  })

  return (
    <PageLayout
      withPadding={true}
      title={`${t('Discours')} :: ${t('Feed')}`}
      key="feed"
      desc="Independent media project about culture, science, art and society with horizontal editing"
    >
      <Suspense fallback={<Loading />}>
        <LoadMoreWrapper
          loadFunction={loadMoreShouts}
          pageSize={FEED_PAGE_SIZE}
          hidden={!isLoadMoreButtonVisible()}
        >
          <ReactionsProvider>
            <FeedView
              shouts={data()?.shouts || []}
              unratedShouts={data()?.unratedShouts || []}
              recentComments={data()?.recentComments || []}
            />
          </ReactionsProvider>
        </LoadMoreWrapper>
      </Suspense>
    </PageLayout>
  )
}
