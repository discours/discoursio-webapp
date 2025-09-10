import { type RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { createResource } from 'solid-js'
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

// Некешируемый загрузчик для SSR
const loadShoutsSSR = (args: QueryLoad_Shouts_ByArgs) => {
  // Используем createCacheableLoader с включенным кешированием для лучшей производительности
  const loader = createCacheableLoader<{ load_shouts_by: Shout[] }, QueryLoad_Shouts_ByArgs>(
    loadShoutsByQuery,
    (args: QueryLoad_Shouts_ByArgs) => args,
    false // ⚡ Кеширование отключено - localStorage переполняется
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
      // Сокращаем timeout до 10 секунд для быстрого fallback
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SSR timeout - 10s exceeded')), 10000)
      })

      const dataPromise = (async () => {
        // Загружаем все данные для SSR

        // Проверяем доступность API с улучшенной диагностикой
        try {
          console.log('[HomePage] Checking API availability:', coreApiUrl)
          const apiCheck = await fetch(coreApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ __typename }' }),
            signal: AbortSignal.timeout(3000) // Сокращаем до 3 секунд
          })

          console.log('[HomePage] API check response:', apiCheck.status, apiCheck.statusText)
          if (!apiCheck.ok) {
            throw new Error(`API недоступен: ${apiCheck.status} ${apiCheck.statusText}`)
          }
        } catch (apiError) {
          console.error('[HomePage] API check failed:', apiError)
          throw new Error(`API недоступен: ${apiError}`)
        }

        // Загружаем featured данные для главной страницы
        const featuredLoader = loadShoutsSSR({
          options: {
            filters: { featured: true },
            limit: FEED_PAGE_SIZE
          }
        })
        const featuredShouts = await featuredLoader()

        // Загружаем top commented shouts
        const topCommentedLoader = loadShoutsSSR({
          options: {
            filters: {},
            order_by: ShoutsOrderBy.CommentsCount,
            limit: 3
          }
        })
        const topCommentedShouts = await topCommentedLoader()

        // Загружаем top month shouts
        const topMonthLoader = loadShoutsSSR({
          options: {
            filters: {
              after: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60 // За последний месяц
            },
            order_by: ShoutsOrderBy.Rating,
            limit: FEED_PAGE_SIZE
          }
        })
        const topMonthShouts = await topMonthLoader()

        // Загружаем top rated shouts
        const topRatedLoader = loadShoutsSSR({
          options: {
            filters: {},
            order_by: ShoutsOrderBy.Rating,
            limit: FEED_PAGE_SIZE
          }
        })
        const topRatedShouts = await topRatedLoader()

        // Загружаем top viewed shouts
        const topViewedLoader = loadShoutsSSR({
          options: {
            filters: {},
            order_by: ShoutsOrderBy.ViewsCount,
            limit: 5
          }
        })
        const topViewedShouts = await topViewedLoader()

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
  const { setFeaturedFeed, setTopMonthFeed, setTopFeed, setTopCommentedFeed } = useFeaturedFeed()

  // ✅ ПАТТЕРН (all-authors): createResource для разрешения Promise из route.load
  const [resolvedData] = createResource(
    () => props.data,
    async (data) => {
      console.log('[HomePage] Resolving route data:', {
        hasData: !!data,
        dataType: typeof data,
        isPromise: data instanceof Promise
      })

      // Если это Promise, ждем разрешения
      const resolved = data instanceof Promise ? await data : data

      console.log('[HomePage] Resolved route data:', {
        hasResolved: !!resolved,
        featuredLength: resolved?.featuredShouts?.length,
        topMonthLength: resolved?.topMonthShouts?.length,
        topRatedLength: resolved?.topRatedShouts?.length,
        topCommentedLength: resolved?.topCommentedShouts?.length
      })

      // ✅ Добавляем данные в контекст после разрешения
      if (resolved?.featuredShouts?.length) {
        console.log('[HomePage] Adding SSR featured to context:', resolved.featuredShouts.length)
        setFeaturedFeed(resolved.featuredShouts)
      }

      if (resolved?.topMonthShouts?.length) {
        console.log('[HomePage] Adding SSR topMonth to context:', resolved.topMonthShouts.length)
        setTopMonthFeed(resolved.topMonthShouts)
      }

      if (resolved?.topRatedShouts?.length) {
        console.log('[HomePage] Adding SSR topRated to context:', resolved.topRatedShouts.length)
        setTopFeed(resolved.topRatedShouts)
      }

      if (resolved?.topCommentedShouts?.length) {
        console.log('[HomePage] Adding SSR topCommented to context:', resolved.topCommentedShouts.length)
        setTopCommentedFeed(resolved.topCommentedShouts)
      }

      return resolved
    },
    {
      // ✅ КРИТИЧНО: initialValue для стабильной гидрации
      initialValue:
        typeof props.data === 'object' && !('then' in props.data)
          ? props.data
          : {
              featuredShouts: [],
              topMonthShouts: [],
              topRatedShouts: [],
              topCommentedShouts: [],
              topViewedShouts: []
            }
    }
  )

  const loadMoreFeatured = async (offset?: number) => {
    try {
      const shoutsLoader = loadShouts({
        options: { filters: { featured: true }, limit: FEED_PAGE_SIZE, offset }
      })
      const loaded = await shoutsLoader()
      if (loaded && Array.isArray(loaded)) {
        // ✅ Простое обновление контекста
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
        {/* ✅ Используем resolvedData вместо прямого props.data */}
        <HomeView
          featuredShouts={resolvedData()?.featuredShouts || []}
          topMonthShouts={resolvedData()?.topMonthShouts || []}
          topViewedShouts={resolvedData()?.topViewedShouts || []}
          topRatedShouts={resolvedData()?.topRatedShouts || []}
          topCommentedShouts={resolvedData()?.topCommentedShouts || []}
        />
      </LoadMoreWrapper>
    </PageLayout>
  )
}
