import { type RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { Suspense, createEffect, createResource, on } from 'solid-js'
import { HomeView, HomeViewProps } from '~/components/Views/HomeView'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { Loading } from '~/components/_shared/Loading'
import { useFeaturedFeed } from '~/context/featured'
import { FEED_PAGE_SIZE } from '~/context/feed'
import { loadShouts } from '~/graphql/api/public'
import { LoadShoutsOptions, ShoutsOrderBy } from '~/graphql/schema/core.gen'
import { PageLayout } from '../components/_shared/PageLayout'
import { useLocalize } from '../context/localize'

const featuredLoader = (offset?: number) => {
  return loadShouts({
    options: { filters: { featured: true }, limit: FEED_PAGE_SIZE, offset }
  })
}

const fetchHomeTopData = async () => {
  const topCommentedLoader = loadShouts({
    options: { filters: { featured: true }, order_by: ShoutsOrderBy.CommentsCount, limit: FEED_PAGE_SIZE }
  })

  const daysago = Date.now() - 30 * 24 * 60 * 60 * 1000
  const after = Math.floor(daysago / 1000)
  const options: LoadShoutsOptions = {
    filters: {
      featured: true,
      after
    },
    order_by: ShoutsOrderBy.Rating,
    limit: FEED_PAGE_SIZE
  }
  const topMonthLoader = loadShouts({ options })

  const topRatedLoader = loadShouts({
    options: {
      filters: { featured: true },
      order_by: ShoutsOrderBy.Rating,
      limit: FEED_PAGE_SIZE
    }
  })
  const topRatedShouts = await topRatedLoader()
  const topMonthShouts = await topMonthLoader()
  const topCommentedShouts = await topCommentedLoader()
  return { topCommentedShouts, topMonthShouts, topRatedShouts } as Partial<HomeViewProps>
}

export const route = {
  load: async () => {
    const featuredLoader = loadShouts({
      options: { filters: { featured: true }, limit: FEED_PAGE_SIZE }
    })
    const featuredShouts = await featuredLoader()
    console.log('Loaded featured shouts:', featuredShouts?.length)

    const topData = await fetchHomeTopData()
    console.log('Loaded top data:', {
      commented: topData.topCommentedShouts?.length,
      month: topData.topMonthShouts?.length,
      rated: topData.topRatedShouts?.length
    })

    return {
      ...topData,
      featuredShouts
    }
  }
} satisfies RouteDefinition

export default function HomePage(props: RouteSectionProps<HomeViewProps>) {
  const { t } = useLocalize()
  const {
    featuredFeed,
    setFeaturedFeed,
    setTopMonthFeed,
    topViewedFeed,
    setTopCommentedFeed,
    setTopFeed,
    topMonthFeed,
    topCommentedFeed,
    topFeed: topRatedFeed
  } = useFeaturedFeed()

  // 1. Create Resources for data loading
  const [featuredShouts] = createResource(() => props.data.featuredShouts, {
    initialValue: props.data.featuredShouts,
    ssrLoadFrom: 'initial'
  })

  const [topData] = createResource(async () => await fetchHomeTopData(), {
    initialValue: {
      topMonthShouts: props.data.topMonthShouts,
      topCommentedShouts: props.data.topCommentedShouts,
      topRatedShouts: props.data.topRatedShouts
    }
  })

  // 2. Effect to update signals if data changes
  createEffect(
    on([featuredShouts, topData], ([featured, top]) => {
      if (featured) setFeaturedFeed(featured)
      if (top) {
        setTopMonthFeed(top.topMonthShouts)
        setTopCommentedFeed(top.topCommentedShouts)
        setTopFeed(top.topRatedShouts)
      }
    })
  )

  const loadMoreFeatured = async (offset?: number) => {
    const shoutsLoader = featuredLoader(offset)
    const loaded = await shoutsLoader()
    if (loaded) {
      setFeaturedFeed((prev) => [...(prev || []), ...loaded])
    }
    return loaded as LoadMoreItems
  }

  return (
    <PageLayout withPadding={true} title={t('Discours')} key="home">
      <Suspense fallback={<Loading />}>
        <LoadMoreWrapper loadFunction={loadMoreFeatured} pageSize={FEED_PAGE_SIZE} hidden={false}>
          <HomeView
            featuredShouts={featuredFeed() || []}
            topMonthShouts={topMonthFeed() || []}
            topViewedShouts={topViewedFeed() || []}
            topRatedShouts={topRatedFeed() || []}
            topCommentedShouts={topCommentedFeed() || []}
          />
        </LoadMoreWrapper>
      </Suspense>
    </PageLayout>
  )
}
