import { RouteSectionProps } from '@solidjs/router'
import { Suspense } from 'solid-js'
import { NoHydration } from 'solid-js/web'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { FeedView } from '~/components/Views/FeedView'
import { FEED_PAGE_SIZE } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { ReactionsProvider } from '~/context/reactions'
import { loadShouts } from '~/graphql/api/public'
import { LoadShoutsFilters, Reaction, ReactionKind, Shout, ShoutsOrderBy } from '~/graphql/generated/graphql'
import { getTimestampFromPeriod, PeriodType } from '~/lib/fromPeriod'

export interface RouteData {
  // Основные ленты для всех режимов
  recentShouts: Shout[]
  hotShouts: Shout[]
  topShouts: Shout[]
  // Дополнительные данные (загружаются на клиенте)
  recentComments: Reaction[]
  unratedShouts: Shout[]
  myRates: Record<string, ReactionKind | undefined>
}

export const route = {
  load: async ({ location: { query } }: RouteSectionProps) => {
    // console.log('[FeedPage] SSR route.load started:', { mode: params.mode })

    try {
      // Добавляем timeout для SSR запросов (15 секунд для 3 запросов)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SSR timeout')), 15000)
      })

      const dataPromise = (async () => {
        // console.log('[FeedPage] Loading all feed modes for instant switching...')

        const filters: LoadShoutsFilters = {}
        if (query.period) filters.after = getTimestampFromPeriod(query.period as PeriodType)

        // Загружаем все 3 режима ленты параллельно для мгновенного переключения
        const [recentShouts, hotShouts, topShouts] = await Promise.all([
          // Recent (по дате создания)
          loadShouts({
            options: {
              filters,
              order_by: undefined, // По умолчанию - по дате
              limit: FEED_PAGE_SIZE + 1
            }
          })(),
          // Hot (по последним комментариям)
          loadShouts({
            options: {
              filters,
              order_by: ShoutsOrderBy.LastCommentedAt,
              limit: FEED_PAGE_SIZE + 1
            }
          })(),
          // Top (по рейтингу)
          loadShouts({
            options: {
              filters,
              order_by: ShoutsOrderBy.Rating,
              limit: FEED_PAGE_SIZE + 1
            }
          })()
        ])

        return {
          recentShouts,
          hotShouts,
          topShouts,
          // Остальные данные загрузим на клиенте
          recentComments: [],
          unratedShouts: []
        }
      })()

      const result = await Promise.race([dataPromise, timeoutPromise])
      // console.log('[FeedPage] SSR route.load completed successfully')
      return result
    } catch (error) {
      console.error('[FeedPage] SSR route.load error:', error)
      return {
        recentShouts: [],
        hotShouts: [],
        topShouts: [],
        recentComments: [],
        unratedShouts: []
      }
    }
  }
}

export default function FeedPage(props: RouteSectionProps<RouteData>) {
  const { t } = useLocalize()

  return (
    <PageLayout
      title={`${t('Discours')} :: ${t('Feed')}`}
      desc={t('Independent media project about culture, science, art and society with horizontal editing')}
    >
      <Suspense fallback={<Loading />}>
        <ReactionsProvider>
          <NoHydration>
            <FeedView
              recentShouts={props.data?.recentShouts || []}
              hotShouts={props.data?.hotShouts || []}
              topShouts={props.data?.topShouts || []}
              unratedShouts={props.data?.unratedShouts || []}
              recentComments={props.data?.recentComments || []}
            />
          </NoHydration>
        </ReactionsProvider>
      </Suspense>
    </PageLayout>
  )
}
