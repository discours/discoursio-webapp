import { RouteSectionProps } from '@solidjs/router'
import { createEffect, createMemo, createSignal, on } from 'solid-js'
import { Suspense } from 'solid-js'

import { FeedView } from '~/components/Views/FeedView'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { FEED_PAGE_SIZE, orderByMode, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { ReactionsProvider } from '~/context/reactions'
import { loadReactions, loadShouts, loadUnratedShouts } from '~/graphql/api/public'
import { LoadShoutsFilters, Reaction, ReactionKind, ReactionSort, Shout } from '~/graphql/schema/core.gen'
import { PeriodType, getTimestampFromPeriod } from '~/lib/fromPeriod'
import { FeedMode } from '~/types/filters'

export interface RouteData {
  shouts: Shout[]
  recentComments: Reaction[]
  unratedShouts: Shout[]
  myRates: Record<string, ReactionKind | undefined>
}

export const route = {
  load: async ({ params, location: { query } }: RouteSectionProps) => {
    console.log('[FeedPage] Route load started:', { params, query })
    const filters: LoadShoutsFilters = {}
    if (query.period) filters.after = getTimestampFromPeriod(query.period as PeriodType)

    try {
      console.log('[FeedPage] Loading initial data with filters:', {
        filters,
        mode: params.mode,
        orderBy: orderByMode(params.mode as FeedMode)
      })

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

      console.log('[FeedPage] Initial data loaded:', {
        shoutsCount: shouts?.length,
        commentsCount: recentComments?.length,
        unratedCount: unratedShouts?.length
      })

      return { shouts, recentComments, unratedShouts }
    } catch (error) {
      console.error('[FeedPage] Error loading initial feed data:', error)
      return { shouts: [], recentComments: [], unratedShouts: [] }
    }
  }
}

export default function FeedPage(props: RouteSectionProps<RouteData>) {
  console.log('[FeedPage] Component render started with props:', props)

  const { t } = useLocalize()
  const { mode, initializeFeed, options, isFeedLoading, addShoutsToFeed } = useFeed()
  const [recentComments, setRecentComments] = createSignal<Reaction[]>(props.data?.recentComments || [])
  const [unratedShouts, setUnratedShouts] = createSignal<Shout[]>(props.data?.unratedShouts || [])
  const [sortedFeed, setSortedFeed] = createSignal<Shout[]>(props.data?.shouts || [])

  // Мемоизируем вычисляемые значения
  const currentFeedName = createMemo(() => {
    const name = mode() ? mode() : 'recent'
    console.log('[FeedPage] Current feed name computed:', { name, mode: mode() })
    return name
  })

  // Состояния для данных
  const [isLoadMoreButtonVisible, setIsLoadMoreButtonVisible] = createSignal(true)

  // Добавим эффект для обновления данных при разрешении Promise
  createEffect(async () => {
    const data = await props.data
    console.log('[FeedPage] Data resolved:', {
      hasShouts: !!data?.shouts?.length,
      hasComments: !!data?.recentComments?.length,
      hasUnrated: !!data?.unratedShouts?.length
    })

    if (data) {
      if (data.recentComments) setRecentComments(data.recentComments)
      if (data.unratedShouts) setUnratedShouts(data.unratedShouts)
      if (data.shouts) {
        setSortedFeed(data.shouts)
        initializeFeed(currentFeedName() as FeedMode, data.shouts)
        setIsLoadMoreButtonVisible(data.shouts.length >= FEED_PAGE_SIZE)
      }
    }
  })

  // Изменим эффект обновления при смене режима
  createEffect(
    on(
      mode,
      async (currentMode) => {
        console.log('[FeedPage] Mode changed, updating additional data:', { currentMode })

        if (!currentMode) return // Добавляем проверку

        try {
          const [newComments, newUnrated] = await Promise.all([
            loadReactions({
              by: {
                kinds: [ReactionKind.Comment],
                sort: ReactionSort.Newest
              },
              limit: 3
            })(),
            loadUnratedShouts({ limit: 5, offset: 0 })()
          ])

          if (newComments) setRecentComments(newComments)
          if (newUnrated) setUnratedShouts(newUnrated)
        } catch (error) {
          console.error('[FeedPage] Error loading additional data:', error)
        }
      },
      { defer: true }
    )
  )

  // Мемоизируем параметры для загрузки
  const loadParams = createMemo(() => ({
    options: {
      ...options(),
      order_by: orderByMode(mode())
    }
  }))

  // Функция загрузки дополнительных постов
  const loadMoreShouts = async (offset?: number): Promise<LoadMoreItems> => {
    console.log('[FeedPage] LoadMore called:', {
      offset,
      isLoading: isFeedLoading(),
      currentMode: mode(),
      params: loadParams()
    })

    if (isFeedLoading()) return []

    try {
      const loaded = await loadShouts(loadParams())()
      console.log('[FeedPage] More shouts loaded:', {
        count: loaded?.length,
        hasMore: (loaded || []).length >= FEED_PAGE_SIZE
      })

      if (loaded?.length) {
        addShoutsToFeed(loaded)
        setIsLoadMoreButtonVisible(loaded.length >= FEED_PAGE_SIZE)
      }

      return loaded || []
    } catch (error) {
      console.error('[FeedPage] Error loading more shouts:', error)
      setIsLoadMoreButtonVisible(false)
      return []
    }
  }

  return (
    <PageLayout
      withPadding={true}
      title={`${t('Discours')} :: ${t('Feed')}`}
      key="feed"
      desc="Independent media project about culture, science, art and society"
    >
      <Suspense fallback={<Loading />}>
        <LoadMoreWrapper
          loadFunction={loadMoreShouts}
          pageSize={FEED_PAGE_SIZE}
          hidden={!isLoadMoreButtonVisible()}
        >
          <ReactionsProvider>
            <FeedView
              shouts={sortedFeed()}
              unratedShouts={unratedShouts()}
              recentComments={recentComments()}
            />
          </ReactionsProvider>
        </LoadMoreWrapper>
      </Suspense>
    </PageLayout>
  )
}
