import { type RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { createEffect } from 'solid-js'
import { isServer } from 'solid-js/web'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { HomeView, HomeViewProps } from '~/components/Views/HomeView'
import { coreApiUrl } from '~/config'
import { useFeaturedFeed } from '~/context/featured'
import { FEED_PAGE_SIZE } from '~/context/feed'
import { loadShouts } from '~/graphql/api/public'
import { createCacheableLoader } from '~/graphql/client'
import { QueryLoad_Shouts_ByArgs, Shout, ShoutsOrderBy } from '~/graphql/generated/graphql'
import loadShoutsByQuery from '~/graphql/query/core/articles-load-by'
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

// Некешируемый загрузчик для SSR
const loadShoutsSSR = (args: QueryLoad_Shouts_ByArgs) => {
  // Используем createCacheableLoader с включенным кешированием для лучшей производительности
  const loader = createCacheableLoader<{ load_shouts_by: Shout[] }, QueryLoad_Shouts_ByArgs>(
    loadShoutsByQuery,
    (args: QueryLoad_Shouts_ByArgs) => args,
    true // Включаем кеширование для SSR
  )(args)

  return async () => {
    try {
      const response = await loader()
      return response?.load_shouts_by || []
    } catch (error) {
      safeLog('loadShoutsSSR error:', error)
      return []
    }
  }
}

// Упрощенная SSR загрузка только критически важных данных
export const route = {
  load: async () => {
    try {
      safeLog('SSR route.load started')

      // Увеличиваем timeout до 20 секунд для стабильной загрузки всех данных
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SSR timeout - 20s exceeded')), 20000)
      })

      const dataPromise = (async () => {
        // Загружаем все данные для SSR
        safeLog('Loading home data for SSR...')

        // Проверяем доступность API
        try {
          const apiCheck = await fetch(coreApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ __typename }' }),
            signal: AbortSignal.timeout(5000) // 5 секунд на проверку API
          })

          if (!apiCheck.ok) {
            throw new Error(`API недоступен: ${apiCheck.status} ${apiCheck.statusText}`)
          }

          safeLog('API доступен, начинаем загрузку данных...')
        } catch (apiError) {
          safeLog('API недоступен:', apiError)
          throw new Error(`API недоступен: ${apiError}`)
        }

        // Загружаем featured данные для главной страницы
        const featuredLoader = loadShoutsSSR({
          options: {
            filters: { featured: true },
            limit: FEED_PAGE_SIZE
          }
        })
        const featuredShouts = await withRetry(async () => await featuredLoader(), 2, 300)

        // Загружаем top commented shouts
        const topCommentedLoader = loadShoutsSSR({
          options: {
            filters: {},
            order_by: ShoutsOrderBy.CommentsCount,
            limit: 3
          }
        })
        const topCommentedShouts = await withRetry(async () => await topCommentedLoader(), 2, 300)

        // Загружаем top month shouts
        const topMonthLoader = loadShoutsSSR({
          options: {
            filters: {},
            limit: FEED_PAGE_SIZE
          }
        })
        const topMonthShouts = await withRetry(async () => await topMonthLoader(), 2, 300)

        // Загружаем top rated shouts
        const topRatedLoader = loadShoutsSSR({
          options: {
            filters: {},
            order_by: ShoutsOrderBy.Rating,
            limit: FEED_PAGE_SIZE
          }
        })
        const topRatedShouts = await withRetry(async () => await topRatedLoader(), 2, 300)

        // Загружаем top viewed shouts
        const topViewedLoader = loadShoutsSSR({
          options: {
            filters: {},
            order_by: ShoutsOrderBy.ViewsCount,
            limit: 5
          }
        })
        const topViewedShouts = await withRetry(async () => await topViewedLoader(), 2, 300)

        safeLog('SSR all data loaded:', {
          featured: featuredShouts?.length || 0,
          topCommented: topCommentedShouts?.length || 0,
          topMonth: topMonthShouts?.length || 0,
          topRated: topRatedShouts?.length || 0,
          topViewed: topViewedShouts?.length || 0
        })

        return {
          featuredShouts: featuredShouts || [],
          topCommentedShouts: topCommentedShouts || [],
          topMonthShouts: topMonthShouts || [],
          topRatedShouts: topRatedShouts || [],
          topViewedShouts: topViewedShouts || []
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

      // В случае ошибки возвращаем пустые данные
      return {
        featuredShouts: [],
        topCommentedShouts: [],
        topMonthShouts: [],
        topRatedShouts: [],
        topViewedShouts: []
      }
    }
  }
} satisfies RouteDefinition

export default function HomePage(props: RouteSectionProps<HomeViewProps>) {
  const { t } = useLocalize()
  const { featuredFeed, setFeaturedFeed } = useFeaturedFeed()

  // Инициализация с SSR данными
  createEffect(() => {
    console.log('[HomePage] Initializing with SSR data:', {
      featuredShouts: props.data?.featuredShouts?.length || 0,
      topCommented: props.data?.topCommentedShouts?.length || 0,
      topMonth: props.data?.topMonthShouts?.length || 0,
      topRated: props.data?.topRatedShouts?.length || 0,
      topViewed: props.data?.topViewedShouts?.length || 0
    })

    if (props.data?.featuredShouts?.length) {
      setFeaturedFeed(props.data.featuredShouts)
    }
  })

  const loadMoreFeatured = async (offset?: number) => {
    try {
      const shoutsLoader = featuredLoader(offset)
      const loaded = await shoutsLoader()
      if (loaded && Array.isArray(loaded)) {
        setFeaturedFeed((prev) => [...(prev || []), ...loaded])
        return loaded as LoadMoreItems
      }
      return [] as LoadMoreItems
    } catch (error) {
      console.error('[HomePage] Error loading more featured:', error)
      return [] as LoadMoreItems
    }
  }

  return (
    <PageLayout withPadding={true} title={t('Discours')} key="home">
      <LoadMoreWrapper loadFunction={loadMoreFeatured} pageSize={FEED_PAGE_SIZE} hidden={false}>
        <HomeView
          featuredShouts={props.data?.featuredShouts || featuredFeed() || []}
          topMonthShouts={props.data?.topMonthShouts || []}
          topViewedShouts={props.data?.topViewedShouts || []}
          topRatedShouts={props.data?.topRatedShouts || []}
          topCommentedShouts={props.data?.topCommentedShouts || []}
        />
      </LoadMoreWrapper>
    </PageLayout>
  )
}
