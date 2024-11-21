import { RouteSectionProps } from '@solidjs/router'
import { createEffect, createMemo, createSignal, on } from 'solid-js'
import { Suspense } from 'solid-js'

import { FeedView } from '~/components/Views/FeedView'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { FEED_PAGE_SIZE, FeedMode, FeedName, orderByMode, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { ReactionsProvider } from '~/context/reactions'
import { useSession } from '~/context/session'
import { loadShoutsMyRates } from '~/graphql/api/private'
import { loadReactions, loadShouts, loadUnratedShouts } from '~/graphql/api/public'
import { LoadShoutsFilters, Reaction, ReactionKind, ReactionSort, Shout } from '~/graphql/schema/core.gen'
import { PeriodType, getFromDate } from '~/lib/fromPeriod'

export interface RouteData {
  shouts: Shout[]
  recentComments: Reaction[]
  unratedShouts: Shout[]
}

export const route = {
  load: async ({ params, location: { query } }: RouteSectionProps) => {
    console.log('[FeedPage] Route load started:', { params, query })
    const filters: LoadShoutsFilters = {}
    if (query.period) filters.after = getFromDate(query.period as PeriodType)

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
  const { mode, initializeFeed, options, isFeedLoading, addShoutsToFeed, setMyRates } = useFeed()
  const { client } = useSession()
  const [sortedFeed, setSortedFeed] = createSignal<Shout[]>(props.data?.shouts || [])

  // Мемоизируем вычисляемые значения
  const currentFeedName = createMemo(() => {
    const name = mode() === 'all' ? 'recent' : mode()
    console.log('[FeedPage] Current feed name computed:', { name, mode: mode() })
    return name
  })

  // Состояния для данных
  const [isLoadMoreButtonVisible, setIsLoadMoreButtonVisible] = createSignal(true)
  const [recentComments, setRecentComments] = createSignal<Reaction[]>(props.data?.recentComments || [])
  const [unratedShouts, setUnratedShouts] = createSignal<Shout[]>(props.data?.unratedShouts || [])

  // Эффект для обновления комментариев и unrated постов
  createEffect(() => {
    console.log('[FeedPage] Updating comments and unrated:', {
      newComments: props.data?.recentComments?.length,
      newUnrated: props.data?.unratedShouts?.length
    })
    if (props.data?.recentComments) {
      setRecentComments(props.data.recentComments)
    }
    if (props.data?.unratedShouts) {
      setUnratedShouts(props.data.unratedShouts)
    }
  })

  // Инициализация фида при получении SSR данных
  createEffect(() => {
    const ssrShouts = props.data?.shouts
    console.log('[FeedPage] SSR initialization effect:', {
      hasShouts: !!ssrShouts?.length,
      currentFeedName: currentFeedName(),
      mode: mode()
    })
    if (ssrShouts?.length) {
      initializeFeed(currentFeedName() as FeedName, ssrShouts)
      setIsLoadMoreButtonVisible(ssrShouts.length >= FEED_PAGE_SIZE)
    }
  })

  // Мемоизируем параметры для загрузки
  const loadParams = createMemo(() => ({
    options: {
      ...options(),
      order_by: orderByMode(mode())
    }
  }))

  // Добавляем эффект для обновления комментариев и unrated при смене режима
  createEffect(
    on(
      mode,
      async (currentMode) => {
        console.log('[FeedPage] Mode changed, updating additional data:', { currentMode })
        
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

          console.log('[FeedPage] Additional data loaded:', {
            commentsCount: newComments?.length,
            unratedCount: newUnrated?.length
          })

          setRecentComments(newComments || [])
          setUnratedShouts(newUnrated || [])
        } catch (error) {
          console.error('[FeedPage] Error loading additional data:', error)
        }
      },
      { defer: true }
    )
  )

  // Восстанавливаем загрузку myRates при изменении фида или авторизации
  createEffect(
    on(
      [sortedFeed, client],
      async ([shouts, authorizedClient]) => {
        console.log('[FeedPage] Loading rates effect triggered:', {
          hasShouts: !!shouts?.length,
          hasClient: !!authorizedClient
        })
        
        if (!(shouts?.length && authorizedClient)) return

        try {
          const myRates = await loadShoutsMyRates(
            shouts.map((s) => s.id),
            authorizedClient
          )()

          console.log('[FeedPage] Rates loaded:', {
            ratesCount: myRates?.length
          })

          if (Array.isArray(myRates)) {
            const ratesMap = myRates.reduce(
              (acc, row) => {
                if (row?.my_rate && row?.shout_id) {
                  acc[row.shout_id] = row.my_rate
                }
                return acc
              },
              {} as Record<string, number>
            )

            setMyRates(ratesMap)
          }
        } catch (error) {
          console.error('[FeedPage] Error loading rates:', error)
        }
      },
      { defer: true }
    )
  )

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
              shouts={props.data?.shouts || []}
              unratedShouts={unratedShouts()}
              recentComments={recentComments()}
            />
          </ReactionsProvider>
        </LoadMoreWrapper>
      </Suspense>
    </PageLayout>
  )
}
