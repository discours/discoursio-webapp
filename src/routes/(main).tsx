import { type RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { createEffect, createResource, on, Suspense } from 'solid-js'
import { isServer } from 'solid-js/web'
import { Loading } from '~/components/_shared/Loading'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { HomeView, HomeViewProps } from '~/components/Views/HomeView'
import { useFeaturedFeed } from '~/context/featured'
import { FEED_PAGE_SIZE } from '~/context/feed'
import { loadShouts } from '~/graphql/api/public'
import { createLoader } from '~/graphql/client'
import loadShoutsByQuery from '~/graphql/query/core/articles-load-by'
import { LoadShoutsOptions, QueryLoad_Shouts_ByArgs, ShoutsOrderBy } from '~/graphql/schema/core.gen'
import { PageLayout } from '../components/_shared/PageLayout'
import { useLocalize } from '../context/localize'

const featuredLoader = (offset?: number) => {
  return loadShouts({
    options: { filters: { featured: true }, limit: FEED_PAGE_SIZE, offset }
  })
}

// Безопасное логирование для SSR
// biome-ignore lint/suspicious/noExplicitAny: ok
const safeLog = (message: string, data?: any) => {
  try {
    if (isServer) {
      // На сервере используем process.stderr для избежания EPIPE
      process.stderr.write(`[HomePage] ${message}\n`)
      if (data) {
        process.stderr.write(`[HomePage] Data: ${JSON.stringify(data)}\n`)
      }
    } else {
      console.log(`[HomePage] ${message}`, data || '')
    }
  } catch {
    // Игнорируем ошибки логирования
  }
}

// biome-ignore lint/suspicious/noExplicitAny: SSR
const withRetry = async (fn: () => Promise<any>, retries = 2, delay = 1000): Promise<any> => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (isServer) {
        process.stderr.write(`[HomePage] Attempt ${i + 1} failed: ${error}\n`)
      } else {
        console.error(`[withRetry] Attempt ${i + 1} failed:`, error)
      }

      if (i === retries) {
        throw error
      }

      // Экспоненциальная задержка
      await new Promise((resolve) => setTimeout(resolve, delay * 2 ** i))
    }
  }
  throw new Error('All retry attempts failed')
}

// Некешируемые загрузчики для SSR
// biome-ignore lint/suspicious/noExplicitAny: ok
const loadShoutsSSR = createLoader<any[], QueryLoad_Shouts_ByArgs>(
  loadShoutsByQuery,
  (args: QueryLoad_Shouts_ByArgs) => args
)

// SSR-безопасная версия загрузки данных с обходом кеша
const fetchHomeTopDataSSR = async () => {
  try {
    safeLog('SSR fetchHomeTopData started')

    const topCommentedLoader = () =>
      loadShoutsSSR({
        options: {
          filters: { featured: true },
          order_by: ShoutsOrderBy.CommentsCount,
          limit: FEED_PAGE_SIZE
        }
      })

    const daysago = Date.now() - 30 * 24 * 60 * 60 * 1000
    const after = Math.floor(daysago / 1000)
    const topMonthLoader = () =>
      loadShoutsSSR({
        options: {
          filters: { featured: true, after },
          order_by: ShoutsOrderBy.Rating,
          limit: FEED_PAGE_SIZE
        }
      })

    const topRatedLoader = () =>
      loadShoutsSSR({
        options: {
          filters: { featured: true },
          order_by: ShoutsOrderBy.Rating,
          limit: FEED_PAGE_SIZE
        }
      })

    // Используем Promise.allSettled для параллельной загрузки с fallback
    const results = await Promise.allSettled([
      withRetry(async () => await topRatedLoader()(), 1, 500),
      withRetry(async () => await topMonthLoader()(), 1, 500),
      withRetry(async () => await topCommentedLoader()(), 1, 500)
    ])

    const topRatedShouts = results[0].status === 'fulfilled' ? results[0].value : []
    const topMonthShouts = results[1].status === 'fulfilled' ? results[1].value : []
    const topCommentedShouts = results[2].status === 'fulfilled' ? results[2].value : []

    safeLog('SSR top data loaded', {
      topRated: topRatedShouts?.length || 0,
      topMonth: topMonthShouts?.length || 0,
      topCommented: topCommentedShouts?.length || 0
    })

    return { topCommentedShouts, topMonthShouts, topRatedShouts } as Partial<HomeViewProps>
  } catch (error) {
    if (isServer) {
      process.stderr.write(`[HomePage] SSR fetchHomeTopData error: ${error}\n`)
    } else {
      console.error('[HomePage] SSR fetchHomeTopData error:', error)
    }
    // Возвращаем пустые массивы в случае ошибки
    return { topCommentedShouts: [], topMonthShouts: [], topRatedShouts: [] } as Partial<HomeViewProps>
  }
}

const fetchHomeTopData = async () => {
  try {
    safeLog('Fetching top data...')

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

    safeLog('Top data fetched successfully')
    return { topCommentedShouts, topMonthShouts, topRatedShouts } as Partial<HomeViewProps>
  } catch (error) {
    console.error('[HomePage] Error fetching top data:', error)
    // Возвращаем пустые массивы в случае ошибки
    return { topCommentedShouts: [], topMonthShouts: [], topRatedShouts: [] } as Partial<HomeViewProps>
  }
}

// Восстанавливаем SSR загрузку с обходом кеша и retry логикой
export const route = {
  load: async () => {
    try {
      safeLog('SSR route.load started')
      safeLog('Environment', {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        hasGraphQLEndpoint: !!process.env.PUBLIC_GRAPHQL_ENDPOINT
      })

      // Добавляем timeout для SSR запросов (максимум 8 секунд)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SSR timeout')), 8000)
      })

      const dataPromise = (async () => {
        // Загружаем featured shouts без кеша
        const featuredLoader = loadShoutsSSR({
          options: {
            filters: { featured: true },
            limit: FEED_PAGE_SIZE
          }
        })

        const [featuredShouts, topData] = await Promise.all([
          withRetry(async () => await featuredLoader(), 1, 500),
          fetchHomeTopDataSSR()
        ])

        return {
          ...topData,
          featuredShouts
        }
      })()

      const result = await Promise.race([dataPromise, timeoutPromise])

      safeLog('SSR route.load completed successfully')
      return result
    } catch (error) {
      if (isServer) {
        process.stderr.write(`[HomePage] SSR route.load error: ${error}\n`)
      } else {
        console.error('[HomePage] SSR route.load error:', error)
      }

      // В случае ошибки возвращаем fallback данные
      return {
        topCommentedShouts: [],
        topMonthShouts: [],
        topRatedShouts: [],
        featuredShouts: []
      }
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

  // 1. Create Resources for data loading - используем SSR данные как initial value
  const [featuredShouts] = createResource(
    async () => {
      // Если данных от SSR нет, загружаем на клиенте
      if (!props.data?.featuredShouts?.length) {
        try {
          console.log('[HomePage] Loading featured shouts on client...')
          const featuredLoader = loadShouts({
            options: { filters: { featured: true }, limit: FEED_PAGE_SIZE }
          })
          const result = await featuredLoader()
          console.log('[HomePage] Featured shouts loaded:', result?.length || 0)
          return result
        } catch (error) {
          console.error('[HomePage] Error loading featured shouts:', error)
          return []
        }
      }
      return props.data.featuredShouts
    },
    {
      initialValue: props.data?.featuredShouts || [],
      ssrLoadFrom: 'initial',
      deferStream: true // Блокируем SSR до загрузки данных
    }
  )

  const [topData] = createResource(
    async () => {
      // Если данных от SSR нет, загружаем на клиенте
      const hasSSRData =
        props.data?.topRatedShouts?.length ||
        props.data?.topMonthShouts?.length ||
        props.data?.topCommentedShouts?.length

      if (!hasSSRData) {
        try {
          console.log('[HomePage] Loading top data on client...')
          return await fetchHomeTopData()
        } catch (error) {
          console.error('[HomePage] Error in topData resource:', error)
          return { topCommentedShouts: [], topMonthShouts: [], topRatedShouts: [] }
        }
      }

      return {
        topMonthShouts: props.data?.topMonthShouts || [],
        topCommentedShouts: props.data?.topCommentedShouts || [],
        topRatedShouts: props.data?.topRatedShouts || []
      }
    },
    {
      initialValue: {
        topMonthShouts: props.data?.topMonthShouts || [],
        topCommentedShouts: props.data?.topCommentedShouts || [],
        topRatedShouts: props.data?.topRatedShouts || []
      },
      deferStream: true // Блокируем SSR до загрузки данных
    }
  )

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
    try {
      const shoutsLoader = featuredLoader(offset)
      const loaded = await shoutsLoader()
      if (loaded) {
        setFeaturedFeed((prev) => [...(prev || []), ...loaded])
      }
      return loaded as LoadMoreItems
    } catch (error) {
      console.error('[HomePage] Error loading more featured:', error)
      return [] as LoadMoreItems
    }
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
