import { useLocation } from '@solidjs/router'
import {
  Accessor,
  JSX,
  Setter,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
  useContext
} from 'solid-js'
import { loadCoauthoredShouts, loadDiscussedShouts, loadFollowedShouts } from '~/graphql/api/private'
import { loadShouts, loadShoutsSearch } from '~/graphql/api/public'
import { LoadShoutsOptions, ReactionKind, Shout, ShoutsOrderBy } from '~/graphql/schema/core.gen'
import { FeedFilters, FeedMode, FilterState, MyFeedKind } from '~/types/filters'
import { useSession } from './session'

export const FEED_PAGE_SIZE = 20
export const EXPO_LAYOUTS = ['audio', 'video', 'literature', 'image']
export const EXPO_TITLES = {
  audio: 'Audio',
  video: 'Video',
  literature: 'Literature',
  image: 'Image'
}

export const orderByMode = (mode: FeedMode) => {
  switch (mode) {
    case 'hot':
      return ShoutsOrderBy.LastCommentedAt
    case 'top':
      return ShoutsOrderBy.Rating
    case 'search':
      return undefined
    case 'comments':
      return ShoutsOrderBy.CommentsCount
    default:
      return undefined
  }
}

interface FeedStore {
  shouts: Shout[]
  isLoading: boolean
  hasMore: boolean
  isEmpty?: boolean
  error?: Error
}

interface FeedContextType {
  // Основные хранилища
  recentFeed: Accessor<FeedStore>
  hotFeed: Accessor<FeedStore>
  topFeed: Accessor<FeedStore>

  // Дополнительные хранилища для других видов выборок
  followedFeed: Accessor<FeedStore>
  discussedFeed: Accessor<FeedStore>
  coauthoredFeed: Accessor<FeedStore>
  searchFeed: Accessor<FeedStore>

  // Общие параметры
  mode: Accessor<FeedMode>
  options: Accessor<LoadShoutsOptions>
  updateOptions: (newOptions: Partial<LoadShoutsOptions>) => void

  // Методы загрузки для каждого типа
  loadRecentFeed: (opts?: Partial<LoadShoutsOptions>) => Promise<void>
  loadHotFeed: (opts?: Partial<LoadShoutsOptions>) => Promise<void>
  loadTopFeed: (opts?: Partial<LoadShoutsOptions>) => Promise<void>
  loadFollowedFeed: (opts?: Partial<LoadShoutsOptions>) => Promise<void>
  loadDiscussedFeed: (opts?: Partial<LoadShoutsOptions>) => Promise<void>
  loadCoauthoredFeed: (opts?: Partial<LoadShoutsOptions>) => Promise<void>
  loadFeedSearch: (text: string, options: LoadShoutsOptions) => Promise<void>

  // Методы для работы с рейтингами
  myRates: Accessor<Record<number, ReactionKind>>
  setMyRates: Setter<Record<number, ReactionKind>>

  // Индикаторы загрузки
  isFeedLoading: Accessor<boolean>
  setIsFeedLoading: Setter<boolean>

  // Группировка фида
  feedByMode: Accessor<FeedStore>
  feedByLayout: Accessor<Record<string, Shout[]>>
  feedByTopic: Accessor<Record<string, Shout[]>>
  feedByAuthor: Accessor<Record<string, Shout[]>>

  // Отслеживание просмотренных
  seen: Accessor<Record<string, number>>
  addSeen: (slug: string) => void

  // Метод для добавления нового shout
  addShoutsToFeed: (shouts: Shout[], mode?: FeedMode) => void

  // Добавим метод для инициализации фида с SSR данными
  initializeFeed: (name: FeedMode, shouts: Shout[]) => void

  // Добавляем поля для фильтров
  filterState: Accessor<FilterState>
  updateFilters: (filters: Partial<FeedFilters>) => void

  myFeed: Accessor<MyFeedKind>
  setMyFeed: Setter<MyFeedKind>
}

const FeedContext = createContext<FeedContextType>({} as FeedContextType)

export const useFeed = () => useContext(FeedContext)

const emptyFeed: FeedStore = { shouts: [], isLoading: false, hasMore: false }

// Добавляем тип для мапы сеттеров
type FeedSettersMap = {
  recent: Setter<FeedStore>
  hot: Setter<FeedStore>
  top: Setter<FeedStore>
  search: Setter<FeedStore>
  comments: Setter<FeedStore>
}

// Добавляем тип для мапы абортконтроллеров
type ControllersMap = {
  recent: AbortController | null
  hot: AbortController | null
  top: AbortController | null
  search: AbortController | null
  comments: AbortController | null
}

// Добавим типы для полей Shout
interface ShoutStats {
  last_commented_at: Date | null
  rating: number
  comments_count: number
  created_at: Date
}

type ShoutWithStats = Shout & ShoutStats

export const FeedProvider = (props: { children: JSX.Element }) => {
  const { client } = useSession()
  const loc = useLocation()
  const [isFeedLoading, setIsFeedLoading] = createSignal(false)
  const [myRates, setMyRates] = createSignal<Record<number, ReactionKind>>({})
  const [myFeed, setMyFeed] = createSignal<MyFeedKind>()

  // Создаем отдельные хранилища для каждого типа выборки
  const [recentFeed, setRecentFeed] = createSignal<FeedStore>(emptyFeed)
  const [hotFeed, setHotFeed] = createSignal<FeedStore>(emptyFeed)
  const [topFeed, setTopFeed] = createSignal<FeedStore>(emptyFeed)
  const [followedFeed, setFollowedFeed] = createSignal<FeedStore>(emptyFeed)
  const [discussedFeed, setDiscussedFeed] = createSignal<FeedStore>(emptyFeed)
  const [coauthoredFeed, setCoauthoredFeed] = createSignal<FeedStore>(emptyFeed)
  const [searchFeed, setSearchFeed] = createSignal<FeedStore>(emptyFeed)

  // Хранилище для текущего фида
  const [feedByLayout, setFeedByLayout] = createSignal<Record<string, Shout[]>>({})
  const [feedByTopic, setFeedByTopic] = createSignal<Record<string, Shout[]>>({})
  const [feedByAuthor, setFeedByAuthor] = createSignal<Record<string, Shout[]>>({})
  const mode = createMemo((): FeedMode => {
    const path = loc.pathname
    const currentMode = path.includes('/feed/') ? path.split('/feed/')[1] || 'recent' : 'recent'
    return currentMode as FeedMode
  })

  const [options, setOptions] = createSignal<LoadShoutsOptions>({ limit: FEED_PAGE_SIZE })
  const updateOptions = (newOpts: Partial<LoadShoutsOptions>) =>
    setOptions((prev) => ({ ...prev, ...newOpts }))

  // Создаем мапу абортконтроллеров
  const controllers: ControllersMap = {
    recent: null,
    hot: null,
    top: null,
    search: null,
    comments: null
  }

  // Создаем мапу сеттеров
  const feedSetters: FeedSettersMap = {
    recent: setRecentFeed,
    hot: setHotFeed,
    top: setTopFeed,
    search: setSearchFeed,
    comments: setRecentFeed
  }

  const updateFeed = (
    name: keyof FeedSettersMap,
    shouts: ShoutWithStats[],
    opts?: { offset?: number; limit?: number }
  ) => {
    const setter = feedSetters[name]
    if (!setter) return

    const existingFeed = setter((prev: FeedStore) => prev)
    const existingIds = new Set(existingFeed.shouts.map((s: Shout) => s.id))
    const uniqueShouts = shouts.filter((s) => !existingIds.has(s.id))

    if (uniqueShouts.length === 0 && !opts?.offset) {
      return
    }

    const newShouts = opts?.offset ? [...existingFeed.shouts, ...uniqueShouts] : uniqueShouts

    const sortedShouts = sortShouts(newShouts as ShoutWithStats[], name as FeedMode)

    const newFeed = {
      shouts: sortedShouts,
      isLoading: false,
      hasMore: shouts.length >= (opts?.limit || FEED_PAGE_SIZE),
      isEmpty: sortedShouts.length === 0,
      error: undefined
    }

    if (existingFeed !== newFeed) {
      setter(newFeed)

      if (name === mode()) {
        Promise.resolve().then(() => {
          setter(newFeed)
        })
      }
    }
  }

  const loadFeed = async (name: FeedMode, opts?: Partial<LoadShoutsOptions>) => {
    const currentFeed = feedSetters[name]((prev: FeedStore) => prev)
    if (currentFeed.isLoading) return

    controllers[name]?.abort()
    controllers[name] = new AbortController()

    const setter = feedSetters[name]
    if (!setter) return

    setter((prev: FeedStore) => ({ ...prev, isLoading: true }))

    try {
      const result = await loadShouts({
        options: {
          ...options(),
          ...opts,
          order_by: orderByMode(name)
        }
      })()

      if (!result?.length) {
        setter({
          shouts: [],
          isLoading: false,
          hasMore: false,
          isEmpty: true,
          error: undefined
        })
        return
      }

      updateFeed(name as keyof FeedSettersMap, result as ShoutWithStats[], {
        limit: opts?.limit || FEED_PAGE_SIZE,
        offset: opts?.offset || 0
      })
    } catch (error) {
      setter((prev: FeedStore) => ({
        ...prev,
        isLoading: false,
        error: error as Error,
        isEmpty: true
      }))
    } finally {
      controllers[name] = null
    }
  }

  // Изменение специализированных методов загрузки для передачи опций и загрузчиков
  const loadRecentFeed = (opts?: Partial<LoadShoutsOptions>) => loadFeed('recent', opts)
  const loadHotFeed = (opts?: Partial<LoadShoutsOptions>) => loadFeed('hot', opts)
  const loadTopFeed = (opts?: Partial<LoadShoutsOptions>) => loadFeed('top', opts)

  // Добавляем отслеживание просмотренных
  const [seen, setSeen] = createSignal<Record<string, number>>({})
  const addSeen = (slug: string) => {
    setSeen((prev) => ({ ...prev, [slug]: Date.now() }))
  }

  // Добавляем методы загрузки для новых типов
  const loadFollowedFeed = async (opts?: Partial<LoadShoutsOptions>) => {
    setFollowedFeed((prev) => ({ ...prev, isLoading: true }))
    console.log('[FeedProvider] Loading followed feed:', { opts })
    try {
      const fetcher = await loadFollowedShouts({ options: { ...options(), ...opts } }, client())
      const result = await fetcher()
      console.log('[FeedProvider] Followed feed loaded:', {
        count: result?.length,
        isEmpty: !result?.length,
        hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE)
      })
      setFollowedFeed((prev: FeedStore) => ({
        shouts: opts?.offset ? [...prev.shouts, ...(result || [])] : result || [],
        isLoading: false,
        hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE),
        isEmpty: !result?.length
      }))
    } catch (error) {
      console.error('[FeedProvider] Failed to load followed feed:', error)
      setFollowedFeed((prev) => ({ ...prev, isLoading: false, error: error as Error }))
    }
  }

  const loadDiscussedFeed = async (opts?: Partial<LoadShoutsOptions>) => {
    setDiscussedFeed((prev) => ({ ...prev, isLoading: true }))
    console.log('[FeedProvider] Loading discussed feed:', { opts })
    try {
      const fetcher = await loadDiscussedShouts({ options: { ...options(), ...opts } }, client())
      const result = await fetcher()
      console.log('[FeedProvider] Discussed feed loaded:', {
        count: result?.length,
        isEmpty: !result?.length,
        hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE)
      })
      setDiscussedFeed((prev: FeedStore) => ({
        shouts: opts?.offset ? [...prev.shouts, ...(result || [])] : result || [],
        isLoading: false,
        hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE),
        isEmpty: !result?.length
      }))
    } catch (error) {
      console.error('[FeedProvider] Failed to load discussed feed:', error)
      setDiscussedFeed((prev) => ({ ...prev, isLoading: false, error: error as Error }))
    }
  }

  const loadCoauthoredFeed = async (opts?: Partial<LoadShoutsOptions>) => {
    setCoauthoredFeed((prev) => ({ ...prev, isLoading: true }))
    console.log('[FeedProvider] Loading coauthored feed:', { opts })
    try {
      const fetcher = await loadCoauthoredShouts({ options: { ...options(), ...opts } }, client())
      const result = await fetcher()
      console.log('[FeedProvider] Coauthored feed loaded:', {
        count: result?.length,
        isEmpty: !result?.length,
        hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE)
      })
      setCoauthoredFeed((prev: FeedStore) => ({
        shouts: opts?.offset ? [...prev.shouts, ...(result || [])] : result || [],
        isLoading: false,
        hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE),
        isEmpty: !result?.length
      }))
    } catch (error) {
      console.error('[FeedProvider] Failed to load coauthored feed:', error)
      setCoauthoredFeed((prev) => ({ ...prev, isLoading: false, error: error as Error }))
    }
  }

  const loadFeedSearch = async (text: string, options: LoadShoutsOptions) => {
    setSearchFeed((prev) => ({ ...prev, isLoading: true }))
    try {
      const result = await loadShoutsSearch(text, options)()
      setSearchFeed((prev) => ({
        shouts: options.offset ? [...prev.shouts, ...(result || [])] : result || [],
        isLoading: false,
        hasMore: (result || []).length >= (options.limit || FEED_PAGE_SIZE)
      }))
    } catch (error) {
      setSearchFeed((prev) => ({ ...prev, isLoading: false, error: error as Error }))
    }
  }

  // Simplify addShoutsToFeed to avoid unnecessary updates
  const addShoutsToFeed = (shouts: Shout[]) => {
    const currentMode = mode() as FeedMode
    const setter = feedSetters[currentMode]

    if (!setter) return

    const currentFeed = setter((prev) => prev)
    const existingIds = new Set(currentFeed.shouts.map((s) => s.id))
    const uniqueShouts = shouts.filter((s) => !existingIds.has(s.id))

    if (uniqueShouts.length === 0) return

    const newShouts = [...currentFeed.shouts, ...uniqueShouts]
    setter((prev) => ({ ...prev, shouts: newShouts }))
  }

  // Simplify mode effect
  createEffect(
    on(
      [mode, myFeed],
      ([currentMode, personalFeed]) => {
        console.log('[FeedProvider] Feed mode/type changed:', {
          mode: currentMode,
          personalFeed,
          client: !!client()
        })

        // Reset states
        setMyRates({})
        updateOptions({ offset: 0 })

        // Сбрасываем текущий фид перед загрузкой нового
        if (personalFeed) {
          // Сброс персональных лент
          setFollowedFeed(emptyFeed)
          setDiscussedFeed(emptyFeed)
          setCoauthoredFeed(emptyFeed)
        } else {
          // Сброс основных лент
          setRecentFeed(emptyFeed)
          setHotFeed(emptyFeed)
          setTopFeed(emptyFeed)
        }

        const loadCurrentFeed = () => {
          if (personalFeed) {
            console.log('[FeedProvider] Loading personal feed:', personalFeed)
            switch (personalFeed) {
              case 'followed':
                return loadFollowedFeed()
              case 'discussed':
                return loadDiscussedFeed()
              case 'coauthored':
                return loadCoauthoredFeed()
              default:
                return undefined
            }
          }

          console.log('[FeedProvider] Loading main feed:', currentMode)
          switch (currentMode) {
            case 'hot':
              return loadHotFeed()
            case 'top':
              return loadTopFeed()
            default:
              return loadRecentFeed()
          }
        }

        Promise.resolve().then(loadCurrentFeed)
      },
      { defer: true }
    )
  )

  // Модифицируем текущий фид
  const currentFeed = createMemo(() => {
    const currentMode = mode()
    const myFeedKind = myFeed()

    if (myFeedKind) {
      switch (myFeedKind) {
        case 'followed':
          return followedFeed()
        case 'discussed':
          return discussedFeed()
        case 'coauthored':
          return coauthoredFeed()
        default:
          return undefined
      }
    }

    switch (currentMode) {
      case 'hot':
        return hotFeed()
      case 'top':
        return topFeed()
      default:
        return recentFeed()
    }
  })

  // Эффект для обновления группировок
  createEffect(
    on(
      () => feedByMode()?.shouts,
      (shouts) => {
        if (!shouts) return
        setFeedByLayout(groupByLayout(shouts))
        setFeedByTopic(groupByTopic(shouts))
        setFeedByAuthor(groupByAuthor(shouts))
      }
    )
  )

  // Эффект для синхронизации текущего фида
  createEffect(() => {
    const feed = currentFeed() || emptyFeed
    const currentMode = mode()
    const setter = feedSetters[currentMode]

    if (setter && feed.shouts[0] && !feedByMode().shouts.includes(feed.shouts[0])) {
      setter({
        shouts: feed.shouts,
        isLoading: false,
        hasMore: feed.shouts.length >= FEED_PAGE_SIZE
      })
    }
  })

  // Добавим метод для инициализации фида с SSR данными
  const initializeFeed = (name: keyof FeedSettersMap, shouts: Shout[]) => {
    const setter = feedSetters[name]
    if (!setter) return

    const newFeed = {
      shouts,
      isLoading: false,
      hasMore: shouts.length >= FEED_PAGE_SIZE,
      error: undefined
    }

    // Устанавливаем значения синхронно
    setter(newFeed)
    setter(newFeed)

    // Обновляем гуппровки
    const groupedByLayout = shouts.reduce(
      (acc, shout) => {
        if (shout.layout) {
          acc[shout.layout] = acc[shout.layout] || []
          acc[shout.layout].push(shout)
        }
        return acc
      },
      {} as Record<string, Shout[]>
    )
    setFeedByLayout(groupedByLayout)

    // Аналогично обновляем отальные группировки...
    const groupedByTopic = shouts.reduce(
      (acc, shout) => {
        if (shout.main_topic) {
          acc[shout.main_topic.slug] = acc[shout.main_topic.slug] || []
          acc[shout.main_topic.slug].push(shout)
        }
        for (const topic of shout.topics || []) {
          if (topic?.slug && topic?.title) {
            acc[topic.slug] = acc[topic.slug] || []
            acc[topic.slug].push(shout)
          }
        }
        return acc
      },
      {} as Record<string, Shout[]>
    )
    setFeedByTopic(groupedByTopic)

    const groupedByAuthor = shouts.reduce(
      (acc, shout) => {
        if (shout.created_by?.id) {
          acc[shout.created_by.id] = acc[shout.created_by.id] || []
          acc[shout.created_by.id].push(shout)
        }
        for (const author of shout.authors || []) {
          if (author?.slug && author?.name) {
            acc[author.slug] = acc[author.slug] || []
            acc[author.slug].push(shout)
          }
        }
        return acc
      },
      {} as Record<string, Shout[]>
    )
    setFeedByAuthor(groupedByAuthor)
  }

  // Добаляем фильтры в зачение контекста
  const [filterState, setFilterState] = createSignal<FilterState>({ filters: {}, timestamp: Date.now() })
  const updateFilters = (filters: Partial<FeedFilters>) => {
    setFilterState((prev) => ({
      filters: { ...prev.filters, ...filters },
      timestamp: Date.now()
    }))
  }

  const feedByMode = createMemo(() => {
    const currentMode = mode()
    const personalFeed = myFeed()

    const mainFeeds = {
      hot: hotFeed,
      top: topFeed,
      recent: recentFeed
    } as const

    const personalFeeds = {
      followed: followedFeed,
      discussed: discussedFeed,
      coauthored: coauthoredFeed
    } as const

    const feed = personalFeed
      ? personalFeeds[personalFeed]?.()
      : currentMode in mainFeeds
        ? mainFeeds[currentMode as keyof typeof mainFeeds]?.()
        : recentFeed()

    return feed || emptyFeed
  })

  const sortShouts = (shouts: ShoutWithStats[], mode: FeedMode) => {
    if (!shouts?.length) return []

    switch (mode) {
      case 'hot':
        return [...shouts].sort(
          (a, b) => (b.last_commented_at?.getTime() || 0) - (a.last_commented_at?.getTime() || 0)
        )
      case 'top':
        return [...shouts].sort((a, b) => (b.rating || 0) - (a.rating || 0))
      case 'comments':
        return [...shouts].sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0))
      default:
        return [...shouts].sort((a, b) => (b.created_at.getTime() || 0) - (a.created_at.getTime() || 0))
    }
  }

  return (
    <FeedContext.Provider
      value={{
        // Основные фиды
        recentFeed,
        hotFeed,
        topFeed,
        followedFeed,
        discussedFeed,
        coauthoredFeed,
        searchFeed,

        // Методы загрузки
        loadRecentFeed,
        loadHotFeed,
        loadTopFeed,
        loadFollowedFeed,
        loadDiscussedFeed,
        loadCoauthoredFeed,
        loadFeedSearch,

        // Опции
        mode,
        options,
        updateOptions: (newOpts) => setOptions((prev) => ({ ...prev, ...newOpts })),

        // Индикаторы и рейтинги
        isFeedLoading,
        setIsFeedLoading,
        myRates,
        setMyRates,

        // Группировки
        feedByMode,
        feedByLayout,
        feedByTopic,
        feedByAuthor,

        // Просмтренные
        seen,
        addSeen,

        // Метод для добавления
        addShoutsToFeed,

        // Добавим метод для инициализации фида с SSR данными
        initializeFeed,

        // Добавляем поля для фильтров
        filterState,
        updateFilters,

        myFeed,
        setMyFeed
      }}
    >
      {props.children}
    </FeedContext.Provider>
  )
}

const groupByLayout = (shouts: Shout[]) =>
  shouts.reduce(
    (acc, shout) => {
      if (shout.layout) {
        acc[shout.layout] = acc[shout.layout] || []
        acc[shout.layout].push(shout)
      }
      return acc
    },
    {} as Record<string, Shout[]>
  )

const groupByTopic = (shouts: Shout[]) =>
  shouts.reduce(
    (acc, shout) => {
      if (shout.main_topic?.slug) {
        acc[shout.main_topic.slug] = acc[shout.main_topic.slug] || []
        acc[shout.main_topic.slug].push(shout)
      }
      return acc
    },
    {} as Record<string, Shout[]>
  )

const groupByAuthor = (shouts: Shout[]) =>
  shouts.reduce(
    (acc, shout) => {
      if (shout.created_by?.id) {
        acc[shout.created_by.id] = acc[shout.created_by.id] || []
        acc[shout.created_by.id].push(shout)
      }
      return acc
    },
    {} as Record<string, Shout[]>
  )
