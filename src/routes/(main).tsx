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
    options: { filters: { featured: true }, order_by: 'comments_count' as ShoutsOrderBy, limit: 10 }
  })

  const daysago = Date.now() - 30 * 24 * 60 * 60 * 1000
  const after = Math.floor(daysago / 1000)
  const options: LoadShoutsOptions = {
    filters: {
      featured: true,
      after
    },
    order_by: 'rating' as ShoutsOrderBy,
    limit: 10
  }
  const topMonthLoader = loadShouts({ options })

  const topRatedLoader = loadShouts({
    options: {
      filters: { featured: true },
      order_by: 'rating' as ShoutsOrderBy,
      limit: 10
    }
  })
  const topRatedShouts = await topRatedLoader()
  const topMonthShouts = await topMonthLoader()
  const topCommentedShouts = await topCommentedLoader()
  return { topCommentedShouts, topMonthShouts, topRatedShouts } as Partial<HomeViewProps>
}

export const route = {
  load: async () => {
    const limit = 20
    const featuredLoader = loadShouts({
      options: { filters: { featured: true }, limit }
    })
    const data = {
      ...(await fetchHomeTopData()),
      featuredShouts: await featuredLoader()
    }
    return data
  }
} satisfies RouteDefinition

export default function HomePage(props: RouteSectionProps<HomeViewProps>) {
  const { t } = useLocalize()
  const {
    featuredFeed,
    setFeaturedFeed,
    topMonthFeed,
    topViewedFeed,
    topCommentedFeed,
    topFeed: topRatedFeed
  } = useFeaturedFeed()

  const [shouts] = createResource(
    () => {
      if (props.data.featuredShouts) {
        setFeaturedFeed(props.data.featuredShouts)
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
            featuredShouts={featuredFeed() || shouts() || []}
            topMonthShouts={topMonthFeed() || props.data.topMonthShouts || []}
            topViewedShouts={topViewedFeed() || []}
            topRatedShouts={topRatedFeed() || props.data.topRatedShouts || []}
            topCommentedShouts={topCommentedFeed() || props.data.topCommentedShouts || []}
          />
        </LoadMoreWrapper>
      </Show>
    </PageLayout>
  )
}
