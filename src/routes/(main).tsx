import { type RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { createEffect, onMount } from 'solid-js'
import { isServer } from 'solid-js/web'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { HomeView, HomeViewProps } from '~/components/Views/HomeView'
import { useFeaturedFeed } from '~/context/featured'
import { FEED_PAGE_SIZE } from '~/context/feed'
import { loadShouts } from '~/graphql/api/public'
import { createLoader } from '~/graphql/client'
import { LoadShoutsOptions, QueryLoad_Shouts_ByArgs, ShoutsOrderBy } from '~/graphql/generated/graphql'
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
// biome-ignore lint/suspicious/noExplicitAny: ok
const loadShoutsSSR = createLoader<any[], QueryLoad_Shouts_ByArgs>(
  loadShoutsByQuery,
  (args: QueryLoad_Shouts_ByArgs) => args
)

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

// Упрощенная SSR загрузка только критически важных данных
export const route = {
  load: async () => {
    try {
      safeLog('SSR route.load started')

      // Увеличиваем timeout до 12 секунд (меньше GraphQL timeout 15s)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SSR timeout')), 12000)
      })

      const dataPromise = (async () => {
        // Загружаем только самые важные featured shouts для первого экрана
        safeLog('Loading critical featured shouts for SSR...')
        const featuredLoader = loadShoutsSSR({
          options: {
            filters: { featured: true },
            limit: FEED_PAGE_SIZE
          }
        })

        // Загружаем только featured shouts в SSR, остальное - на клиенте
        const featuredShouts = await withRetry(async () => await featuredLoader(), 2, 300)

        safeLog('SSR critical data loaded', {
          featured: featuredShouts?.length || 0
        })

        return {
          featuredShouts,
          // Пустые массивы для остальных данных - загрузим на клиенте
          topCommentedShouts: [],
          topMonthShouts: [],
          topRatedShouts: []
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
  const { featuredFeed, setFeaturedFeed, topMonthFeed, topViewedFeed, topCommentedFeed, topFeed } =
    useFeaturedFeed()

  // Инициализация с SSR данными (только featured шуты)
  createEffect(() => {
    console.log('[HomePage] Initializing with SSR data:', {
      featuredShouts: props.data?.featuredShouts?.length || 0
    })

    if (props.data?.featuredShouts?.length) {
      setFeaturedFeed(props.data.featuredShouts)
    }
  })

  // Убираем загрузку дополнительных данных - она будет в компонентах
  onMount(() => {
    // Загружаем featured shouts если нет SSR данных
    if (!props.data?.featuredShouts?.length && !featuredFeed()?.length) {
      void loadFeaturedShoutsAsync()
    }
  })

  const loadFeaturedShoutsAsync = async () => {
    try {
      console.log('[HomePage] Loading featured shouts on client...')
      const featuredLoader = loadShouts({
        options: { filters: { featured: true }, limit: FEED_PAGE_SIZE }
      })
      const result = await featuredLoader()
      if (result?.length) {
        setFeaturedFeed(result)
      }
    } catch (error) {
      console.error('[HomePage] Error loading featured shouts:', error)
    }
  }

  // Функция удалена - загрузка данных перенесена в компоненты

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
      <LoadMoreWrapper loadFunction={loadMoreFeatured} pageSize={FEED_PAGE_SIZE} hidden={false}>
        <HomeView
          featuredShouts={props.data?.featuredShouts || featuredFeed() || []}
          topMonthShouts={topMonthFeed() || []}
          topViewedShouts={topViewedFeed() || []}
          topRatedShouts={topFeed() || []}
          topCommentedShouts={topCommentedFeed() || []}
        />
      </LoadMoreWrapper>
    </PageLayout>
  )
}
