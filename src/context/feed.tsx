import { createLazyMemo } from '@solid-primitives/memo'
import { useParams } from '@solidjs/router'
import { Accessor, JSX, Setter, createContext, createEffect, createSignal, on, useContext } from 'solid-js'
import { loadCoauthoredShouts, loadDiscussedShouts, loadFollowedShouts } from '~/graphql/api/private'
import { loadShouts, loadShoutsSearch } from '~/graphql/api/public'
import {
  Author,
  LoadShoutsOptions,
  ReactionKind,
  Shout,
  ShoutsOrderBy,
  Topic
} from '~/graphql/schema/core.gen'
import { useSession } from './session'

export const FEED_PAGE_SIZE = 20
export const EXPO_LAYOUTS = ['audio', 'video', 'literature', 'image']
export const EXPO_TITLES = {
  audio: 'Audio',
  video: 'Video',
  literature: 'Literature',
  image: 'Image'
}

export const orderByMode = (value: string) => {
  return value === 'hot'
    ? ShoutsOrderBy.LastReactedAt
    : value === 'top'
      ? ShoutsOrderBy.Rating
      : value === 'followed'
        ? undefined
        : value === 'discussed'
          ? ShoutsOrderBy.LastReactedAt
          : value === 'coauthored'
            ? undefined
            : undefined
}

export type FeedMode = 'all' | 'recent' | 'hot' | 'top' | 'followed' | 'discussed' | 'coauthored'
export type FeaturedFilter = 'featured' | 'unfeatured' | 'all'

interface FeedContextType {
  // Core state
  feed: Accessor<Shout[]>
  setFeed: Setter<Shout[]>
  options: Accessor<LoadShoutsOptions>
  updateOptions: (newOptions: Partial<LoadShoutsOptions>) => void
  isFeedLoading: Accessor<boolean>

  // Feed loading methods
  loadFeed: (opts?: Partial<LoadShoutsOptions>) => Promise<{ hasMore: boolean; newShouts: Shout[] }>

  // Feeds
  loadFollowed: (options: LoadShoutsOptions) => Promise<{ hasMore: boolean; newShouts: Shout[] }>
  loadDiscussed: (options: LoadShoutsOptions) => Promise<{ hasMore: boolean; newShouts: Shout[] }>
  loadCoauthored: (options: LoadShoutsOptions) => Promise<{ hasMore: boolean; newShouts: Shout[] }>
  loadFeedSearch: (
    text: string,
    options: LoadShoutsOptions
  ) => Promise<{ hasMore: boolean; newShouts: Shout[] }>
  // Feed organization
  feedByLayout: Accessor<{ [layout: string]: Shout[] }>
  feedByTopic: Accessor<{ [topicSlug: string]: Shout[] }>
  feedByAuthor: Accessor<{ [authorSlug: string]: Shout[] }>
  // Seen tracking
  seen: Accessor<{ [slug: string]: number }>
  addSeen: (slug: string) => void

  // My rates
  myRates: Accessor<Record<number, ReactionKind>>
  setMyRates: Setter<Record<number, ReactionKind>>
}

const FeedContext = createContext<FeedContextType>({} as FeedContextType)

export const useFeed = () => useContext(FeedContext)

export const FeedProvider = (props: { children: JSX.Element }) => {
  const { client } = useSession()
  const params = useParams<{ mode: FeedMode }>()
  const [feed, setFeed] = createSignal<Shout[]>([])
  const [isFeedLoading, setIsFeedLoading] = createSignal(false)
  const [myRates, setMyRates] = createSignal<Record<number, ReactionKind>>({})
  const [options, setOptions] = createSignal<LoadShoutsOptions>({
    limit: FEED_PAGE_SIZE,
    filters: {}
  })

  // Добавляем сигнал для отслеживания последнего запроса
  const [currentRequestId, setCurrentRequestId] = createSignal<number>(0)

  // Добавляем эффект для автоматической загрузки при изменении options
  createEffect(
    on(
      options,
      async (newOptions) => {
        if (!isFeedLoading()) {
          // Предотвращаем повторные загрузки
          const result = await loadFeed(newOptions)
          if (result.newShouts) {
            setFeed(result.newShouts)
          }
        }
      },
      { defer: true } // Откладываем первый запуск до необходимости
    )
  )

  // Добавляем отслеживание изменения mode
  createEffect(() => {
    const currentMode = params.mode || 'recent'
    // При изменении режима сбрасываем ленту и загружаем заново
    updateOptions({
      offset: 0, // Сбрасываем пагинацию
      order_by: orderByMode(currentMode), // Обновляем сортировку
      filters: {} // Сбрасываем фильтры если нужно
    })
  })

  // Обновляем updateOptions для более надежной работы
  const updateOptions = (newOptions: Partial<LoadShoutsOptions>) => {
    setOptions((prev) => {
      const updated = { ...prev, ...newOptions }
      // Если сбрасываем offset или меняется режим сортировки, очищаем текущий feed
      if (newOptions.offset === 0 || newOptions.order_by !== prev.order_by) {
        setFeed([])
      }
      return updated
    })
  }

  // Обновляем loadFeed для защиты от race condition
  const loadFeed = async (opts?: Partial<LoadShoutsOptions>) => {
    const currentOptions = { ...options(), ...opts }
    const currentMode = params.mode || 'recent'

    // Генерируем уникальный ID для этого запроса
    const requestId = Date.now()
    setCurrentRequestId(requestId)

    setIsFeedLoading(true)
    try {
      let result: { hasMore: boolean; newShouts: Shout[] }

      switch (currentMode) {
        case 'followed': {
          const followedResult = await loadFollowed(currentOptions)
          // Проверяем, не устарел ли запрос
          if (requestId !== currentRequestId()) return { hasMore: false, newShouts: [] }
          result = followedResult
          break
        }
        case 'discussed': {
          currentOptions.order_by = ShoutsOrderBy.LastReactedAt
          const discussedResult = await loadDiscussed(currentOptions)
          if (requestId !== currentRequestId()) return { hasMore: false, newShouts: [] }
          result = discussedResult
          break
        }
        case 'coauthored': {
          const coauthoredResult = await loadCoauthored(currentOptions)
          if (requestId !== currentRequestId()) return { hasMore: false, newShouts: [] }
          result = coauthoredResult
          break
        }
        default: {
          const fetcher = loadShouts({ options: currentOptions })
          const shouts = await fetcher()
          if (requestId !== currentRequestId()) return { hasMore: false, newShouts: [] }
          result = {
            hasMore: (shouts || []).length >= (currentOptions.limit || FEED_PAGE_SIZE),
            newShouts: shouts || []
          }
        }
      }

      // Обновляем ленту только если запрос все еще актуален
      if (requestId === currentRequestId()) {
        return result
      }
      return { hasMore: false, newShouts: [] }
    } finally {
      // Сбрасываем loading только если это последний запрос
      if (requestId === currentRequestId()) {
        setIsFeedLoading(false)
      }
    }
  }

  const loadFeedSearch = async (text: string, options: LoadShoutsOptions) => {
    const fetcher = loadShoutsSearch(text, options)
    const result = (await fetcher()) || []
    const hasMore = result.length >= options.limit
    return { hasMore, newShouts: result }
  }

  const loadFollowed = async (options: LoadShoutsOptions) => {
    const fetcher = loadFollowedShouts({ options }, client())
    const result = (await fetcher()) || []
    const hasMore = result.length >= options.limit
    return { hasMore, newShouts: result }
  }

  const loadDiscussed = async (options: LoadShoutsOptions) => {
    const fetcher = loadDiscussedShouts({ options }, client())
    const result = (await fetcher()) || []
    const hasMore = result.length >= options.limit
    return { hasMore, newShouts: result }
  }

  const loadCoauthored = async (options: LoadShoutsOptions) => {
    const fetcher = loadCoauthoredShouts({ options }, client())
    const result = (await fetcher()) || []
    const hasMore = result.length >= options.limit
    return { hasMore, newShouts: result }
  }
  const [seen, setSeen] = createSignal<{ [slug: string]: number }>({})
  const addSeen = async (slug: string) => {
    setSeen((prev: Record<string, number>) => {
      const newSeen = { ...prev, [slug]: Date.now() }
      return newSeen
    })
  }

  const feedByAuthor = createLazyMemo(() => {
    return Object.values(feed()).reduce(
      (acc, article: Shout) => {
        article.authors?.forEach((author: Author | null) => {
          if (!acc[author?.slug || '']) {
            acc[author?.slug || ''] = []
          }
          acc[author?.slug || ''].push(article)
        })
        return acc
      },
      {} as { [authorSlug: string]: Shout[] }
    )
  })

  const feedByTopic = createLazyMemo(() => {
    return Object.values(feed()).reduce(
      (acc, article: Shout) => {
        article.topics?.forEach((topic: Topic | null) => {
          if (topic?.slug) {
            if (!acc[topic.slug]) {
              acc[topic.slug] = []
            }
            acc[topic.slug].push(article)
          }
        })
        return acc
      },
      {} as { [topicSlug: string]: Shout[] }
    )
  })

  const feedByLayout = createLazyMemo(() => {
    return Object.values(feed()).reduce(
      (acc, article: Shout) => {
        acc[article.layout] = acc[article.layout] || []
        acc[article.layout].push(article)
        return acc
      },
      {} as { [layout: string]: Shout[] }
    )
  })

  return (
    <FeedContext.Provider
      value={{
        myRates,
        setMyRates,
        feed,
        setFeed,
        options,
        updateOptions,
        isFeedLoading,
        loadFeed,
        loadFollowed,
        loadDiscussed,
        loadCoauthored,
        loadFeedSearch,
        feedByLayout,
        feedByTopic,
        feedByAuthor,
        seen,
        addSeen
      }}
    >
      {props.children}
    </FeedContext.Provider>
  )
}
