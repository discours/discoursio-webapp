import { RouteSectionProps } from '@solidjs/router'
import { createEffect, createSignal } from 'solid-js'
import { Suspense } from 'solid-js'

import { FeedView } from '~/components/Views/FeedView'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { FEED_PAGE_SIZE, orderByMode } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { ReactionsProvider } from '~/context/reactions'
import { loadReactions, loadShouts, loadUnratedShouts } from '~/graphql/api/public'
import { LoadShoutsFilters, Reaction, ReactionKind, ReactionSort, Shout } from '~/graphql/schema/core.gen'
import { PeriodType, getTimestampFromPeriod } from '~/lib/fromPeriod'
import { FeedMode } from '~/types/nav'

export interface RouteData {
  shouts: Shout[]
  recentComments: Reaction[]
  unratedShouts: Shout[]
  myRates: Record<string, ReactionKind | undefined>
}

export const route = {
  load: async ({ params, location: { query } }: RouteSectionProps) => {
    const filters: LoadShoutsFilters = {}
    if (query.period) filters.after = getTimestampFromPeriod(query.period as PeriodType)

    try {
      const [shouts, recentComments, unratedShouts] = await Promise.all([
        loadShouts({
          options: {
            filters,
            order_by: orderByMode(params.mode as FeedMode),
            limit: FEED_PAGE_SIZE + 1
          }
        })(),
        loadReactions({
          by: {
            kinds: [ReactionKind.Comment],
            sort: ReactionSort.Newest
          },
          limit: 3
        })(),
        loadUnratedShouts({ limit: 5, offset: 0 })()
      ])
      return { shouts, recentComments, unratedShouts }
    } catch (error) {
      console.error('[FeedPage] Error loading initial feed data:', error)
      return { shouts: [], recentComments: [], unratedShouts: [] }
    }
  }
}

export default function FeedPage(props: RouteSectionProps<RouteData>) {
  const { t } = useLocalize()
  const [recentComments, setRecentComments] = createSignal<Reaction[]>(props.data?.recentComments || [])
  const [unratedShouts, setUnratedShouts] = createSignal<Shout[]>(props.data?.unratedShouts || [])
  const [sortedFeed, setSortedFeed] = createSignal<Shout[]>(props.data?.shouts || [])

  // Обновляем данные при их получении
  createEffect(async () => {
    const data = await props.data
    if (data) {
      setRecentComments(data.recentComments)
      setUnratedShouts(data.unratedShouts)
      setSortedFeed(data.shouts)
    }
  })

  return (
    <PageLayout
      title={`${t('Discours')} :: ${t('Feed')}`}
      desc="Independent media project about culture, science, art and society"
    >
      <Suspense fallback={<Loading />}>
        <ReactionsProvider>
          <FeedView
            shouts={sortedFeed()}
            unratedShouts={unratedShouts()}
            recentComments={recentComments()}
          />
        </ReactionsProvider>
      </Suspense>
    </PageLayout>
  )
}
