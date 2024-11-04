import { createLazyMemo } from '@solid-primitives/memo'
import { makePersisted } from '@solid-primitives/storage'
import { Accessor, JSX, Setter, createContext, createSignal, useContext } from 'solid-js'
import { FeedMode, ShoutsOrder } from '~/components/Feed/FeedFilters'
import { loadFollowedShouts } from '~/graphql/api/private'
import { loadShoutsSearch as fetchShoutsSearch, getShout, loadShouts } from '~/graphql/api/public'
import { Author, LoadShoutsOptions, Shout, ShoutsOrderBy, Topic } from '~/graphql/schema/core.gen'
import { ExpoLayoutType } from '~/types/common'
import { byStat } from '../utils/sort'
import { useSession } from './session'

export const PRERENDERED_ARTICLES_COUNT = 5
export const SHOUTS_PER_PAGE = 20
export const EXPO_LAYOUTS = ['audio', 'literature', 'video', 'image'] as ExpoLayoutType[]
export const EXPO_TITLES: Record<ExpoLayoutType | '', string> = {
  audio: 'Audio',
  video: 'Video',
  image: 'Artworks',
  literature: 'Literature',
  '': 'All'
}

type FeedContextType = {
  sortedFeed: Accessor<Shout[]>
  articleEntities: Accessor<{ [articleSlug: string]: Shout }>
  feedByAuthor: Accessor<{ [authorSlug: string]: Shout[] }>
  feedByTopic: Accessor<{ [topicSlug: string]: Shout[] }>
  feedByLayout: Accessor<{ [layout: string]: Shout[] }>
  topViewedFeed: Accessor<Shout[]>
  topCommentedFeed: Accessor<Shout[]>
  addFeed: (articles?: Shout[]) => void
  loadShout: (slug: string) => Promise<void>
  loadShouts: (options: LoadShoutsOptions) => Promise<{ hasMore: boolean; newShouts: Shout[] }>
  loadMyFeed: (options: LoadShoutsOptions) => Promise<{ hasMore: boolean; newShouts: Shout[] }>
  loadShoutsSearch: ({
    text,
    options
  }: { text: string; options?: LoadShoutsOptions }) => Promise<{ hasMore: boolean; newShouts: Shout[] }>
  resetSortedFeed: () => void
  seen: Accessor<{ [slug: string]: number }>
  addSeen: (slug: string) => void

  // all
  feed: Accessor<Shout[] | undefined>
  setFeed: Setter<Shout[]>

  // featured
  featuredFeed: Accessor<Shout[] | undefined>
  setFeaturedFeed: Setter<Shout[]>

  // top month
  loadTopMonthFeed: () => Promise<void>
  topMonthFeed: Accessor<Shout[]>

  // top rated
  loadTopFeed: () => Promise<void>
  topFeed: Accessor<Shout[]>

  // expo
  expoFeed: Accessor<Shout[] | undefined>
  setExpoFeed: Setter<Shout[]>

  // options
  feedOptions: Accessor<FeedOptions>
  updateFeedOptions: (options: Partial<FeedOptions>) => void
  setFeedOptions: Setter<FeedOptions>

  // loading
  isFeedLoading: Accessor<boolean>
  setFeedLoading: Setter<boolean>
}

const FeedContext = createContext<FeedContextType>({} as FeedContextType)

export const useFeed = () => useContext(FeedContext)

type FeedOptions = {
  mode: FeedMode
  order: ShoutsOrder
  layout?: ExpoLayoutType
  filters: LoadShoutsOptions['filters']
}

export const FeedProvider = (props: { children: JSX.Element }) => {
  const [sortedFeed, setSortedFeed] = createSignal<Shout[]>([])
  const [articleEntities, setArticleEntities] = createSignal<{ [articleSlug: string]: Shout }>({})
  const [feed, setFeed] = createSignal<Shout[]>([] as Shout[])
  const [featuredFeed, setFeaturedFeed] = createSignal<Shout[]>([])
  const [expoFeed, setExpoFeed] = createSignal<Shout[]>([])
  const [topFeed, setTopFeed] = createSignal<Shout[]>([])
  const [isFeedLoading, setFeedLoading] = createSignal<boolean>(false)
  const [topMonthFeed, setTopMonthFeed] = createSignal<Shout[]>([])
  const [feedByLayout, _setFeedByLayout] = createSignal<{ [layout: string]: Shout[] }>({})
  const [seen, setSeen] = makePersisted(createSignal<{ [slug: string]: number }>({}), {
    name: 'discoursio-seen'
  })
  const [feedOptions, setFeedOptions] = createSignal<FeedOptions>({
    mode: 'all',
    order: 'recent',
    filters: {}
  })

  const updateFeedOptions = (options: Partial<FeedOptions>) => {
    setFeedOptions((prev) => ({
      ...prev,
      ...options
    }))
  }

  const addSeen = async (slug: string) => {
    setSeen((prev: Record<string, number>) => {
      const newSeen = { ...prev, [slug]: Date.now() }
      return newSeen
    })
  }

  // Memoized articles grouped by author
  const feedByAuthor = createLazyMemo(() => {
    return Object.values(articleEntities()).reduce(
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

  // Memoized articles grouped by topic
  const feedByTopic = createLazyMemo(() => {
    return Object.values(articleEntities()).reduce(
      (acc, article: Shout) => {
        article.topics?.forEach((topic: Topic | null) => {
          if (!acc[topic?.slug || '']) {
            acc[topic?.slug || ''] = []
          }
          acc[topic?.slug || ''].push(article)
        })
        return acc
      },
      {} as { [topicSlug: string]: Shout[] }
    )
  })

  // Memoized top viewed articles
  const topViewedFeed = createLazyMemo(() => {
    const result = Object.values(articleEntities())
    // @ts-ignore
    result.sort(byStat('viewed'))
    return result
  })

  // Memoized top commented articles
  const topCommentedFeed = createLazyMemo(() => {
    const result = Object.values(articleEntities())
    // @ts-ignore
    result.sort(byStat('commented'))
    return result
  })

  // Add articles to the articleEntities and sortedFeed state
  const addFeed = (articles?: Shout[]) => {
    const newArticleEntities = (articles || []).reduce(
      (acc, article) => {
        if (!acc[article.slug]) {
          acc[article.slug] = article
        }
        return acc
      },
      {} as { [articleSlug: string]: Shout }
    )

    setArticleEntities((prevArticleEntities) => ({
      ...prevArticleEntities,
      ...newArticleEntities
    }))

    setSortedFeed((prevSortedFeed) => [...prevSortedFeed, ...(articles || [])])
  }

  // Load a single shout by slug and update the articleEntities and sortedFeed state
  const loadShout = async (slug: string): Promise<void> => {
    const fetcher = await getShout({ slug })
    const newArticle = (await fetcher()) as Shout
    addFeed([newArticle])
    const newArticleIndex = sortedFeed().findIndex((s) => s.id === newArticle.id)
    if (newArticleIndex >= 0) {
      const newSortedFeed = [...sortedFeed()]
      newSortedFeed[newArticleIndex] = articleEntities()?.[newArticle?.slug || '']
      setSortedFeed(newSortedFeed)
    }
  }

  // Load shouts based on the provided options and update the articleEntities and sortedFeed state
  const loadShoutsBy = async (
    options: LoadShoutsOptions
  ): Promise<{ hasMore: boolean; newShouts: Shout[] }> => {
    const fetcher = await loadShouts({ options })
    const result = (await fetcher()) || []
    const hasMore = result.length !== options.limit + 1 && result.length !== 0
    if (hasMore) result.splice(-1)
    addFeed(result)
    return { hasMore, newShouts: result }
  }
  const { client } = useSession()

  // Load the user's feed based on the provided options and update the articleEntities and sortedFeed state
  const loadMyFeed = async (
    options: LoadShoutsOptions
  ): Promise<{ hasMore: boolean; newShouts: Shout[] }> => {
    if (!options.limit) options.limit = 0
    options.limit += 1
    const fetcher = await loadFollowedShouts(client(), { options })
    const result = (await fetcher()) || []
    const hasMore = result.length === options.limit + 1
    if (hasMore) result.splice(-1)
    addFeed(result || [])
    return { hasMore, newShouts: result }
  }

  // Load shouts based on the search query and update the articleEntities and sortedFeed state
  const loadShoutsSearch = async ({
    text,
    options
  }: { text: string; options?: LoadShoutsOptions }): Promise<{ hasMore: boolean; newShouts: Shout[] }> => {
    const limit = (options?.limit || 0) + 1
    const fetcher = fetchShoutsSearch(text, { ...options, limit })
    const result = (await fetcher()) || []
    const hasMore = result.length === limit
    if (hasMore) result.splice(-1)
    addFeed(result)
    return { hasMore, newShouts: result }
  }

  // Reset the sortedFeed state
  const resetSortedFeed = () => {
    setSortedFeed([])
  }

  // Load the top articles from the last month and update the topMonthFeed state
  const loadTopMonthFeed = async (): Promise<void> => {
    const daysago = Date.now() - 30 * 24 * 60 * 60 * 1000
    const after = Math.floor(daysago / 1000)
    const options: LoadShoutsOptions = {
      filters: {
        featured: true,
        after
      },
      order_by: 'rating' as ShoutsOrderBy,
      limit: 10
    }
    const fetcher = await loadShouts({ options })
    const result = (await fetcher()) || []
    addFeed(result)
    setTopMonthFeed(result)
  }
  // Load the top articles and update the topFeed state
  const loadTopFeed = async (): Promise<void> => {
    const options: LoadShoutsOptions = {
      filters: { featured: true },
      // order_by: published_at
      limit: 10
    }
    const fetcher = await loadShouts({ options })
    const result = (await fetcher()) || []
    addFeed(result)
    setTopFeed(result)
  }

  return (
    <FeedContext.Provider
      value={{
        sortedFeed,
        articleEntities,
        topFeed,
        topMonthFeed,
        feedByAuthor,
        feedByTopic,
        feedByLayout,
        topViewedFeed,
        topCommentedFeed,
        addFeed,
        loadShout,
        loadShouts: loadShoutsBy,
        loadMyFeed,
        loadShoutsSearch,
        resetSortedFeed,
        loadTopMonthFeed,
        loadTopFeed,
        seen,
        addSeen,
        featuredFeed,
        setFeaturedFeed,
        expoFeed,
        setExpoFeed,
        feed,
        setFeed,
        feedOptions,
        updateFeedOptions,
        setFeedOptions,
        isFeedLoading,
        setFeedLoading
      }}
    >
      {props.children}
    </FeedContext.Provider>
  )
}
