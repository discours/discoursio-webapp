import { type RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { createEffect, createResource } from 'solid-js'
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
      console.log('loadShoutsSSR error:', error)
      return []
    }
  }
}

// Упрощенная SSR загрузка только критически важных данных
export const route = {
  load: async () => {
    try {
      // Увеличиваем timeout до 20 секунд для стабильной загрузки всех данных
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SSR timeout - 20s exceeded')), 20000)
      })

      const dataPromise = (async () => {
        // Загружаем все данные для SSR

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
        } catch (apiError) {
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

        const result = {
          featuredShouts: featuredShouts || [],
          topCommentedShouts: topCommentedShouts || [],
          topMonthShouts: topMonthShouts || [],
          topRatedShouts: topRatedShouts || [],
          topViewedShouts: topViewedShouts || []
        }

        return result
      })()

      return await Promise.race([dataPromise, timeoutPromise])
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
  const { setFeaturedFeed } = useFeaturedFeed()

  // ✅ ПРАВИЛЬНО: createResource с SSR данными (Ryan Carniato pattern)
  const [featuredShouts] = createResource(
    () => 'featured', // статический ключ
    async () => {
      const loader = featuredLoader()
      return await loader()
    },
    {
      initialValue: props.data?.featuredShouts || [],
      ssrLoadFrom: 'initial'
    }
  )

  // Синхронизируем контекст с ресурсом только для loadMore
  createEffect(() => {
    const data = featuredShouts()
    if (data?.length) {
      setFeaturedFeed(data)
    }
  })

  const loadMoreFeatured = async (offset?: number) => {
    try {
      const shoutsLoader = featuredLoader(offset)
      const loaded = await shoutsLoader()
      if (loaded && Array.isArray(loaded)) {
        // Обновляем и контекст и перезапускаем ресурс
        setFeaturedFeed((prev) => [...(prev || featuredShouts() || []), ...loaded])
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
          featuredShouts={featuredShouts() || []}
          topMonthShouts={props.data?.topMonthShouts || []}
          topViewedShouts={props.data?.topViewedShouts || []}
          topRatedShouts={props.data?.topRatedShouts || []}
          topCommentedShouts={props.data?.topCommentedShouts || []}
        />
      </LoadMoreWrapper>
    </PageLayout>
  )
}
