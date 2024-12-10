import { type RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { Show, createResource } from 'solid-js'
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

  const [shouts] = createResource(
    () => {
      if (props.data.featuredShouts) {
        setFeaturedFeed(props.data.featuredShouts)
      }
      if (props.data.topMonthShouts) {
        setTopMonthFeed(props.data.topMonthShouts)
      }
      if (props.data.topCommentedShouts) {
        setTopCommentedFeed(props.data.topCommentedShouts)
      }
      if (props.data.topRatedShouts) {
        setTopFeed(props.data.topRatedShouts)
      }
      return props.data.featuredShouts
    },
    {
      initialValue: props.data.featuredShouts,
      ssrLoadFrom: 'initial'
    }
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
      <Show when={!shouts.loading && featuredFeed()} fallback={<Loading />}>
        <LoadMoreWrapper loadFunction={loadMoreFeatured} pageSize={FEED_PAGE_SIZE} hidden={false}>
          <HomeView
            featuredShouts={featuredFeed() || []}
            topMonthShouts={topMonthFeed() || []}
            topViewedShouts={topViewedFeed() || []}
            topRatedShouts={topRatedFeed() || []}
            topCommentedShouts={topCommentedFeed() || []}
          />
        </LoadMoreWrapper>
      </Show>
    </PageLayout>
  )
}
