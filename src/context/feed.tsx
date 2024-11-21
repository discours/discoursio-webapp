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

export type FeedMode = 'all' | 'recent' | 'hot' | 'top' | 'followed' | 'discussed' | 'coauthored' | 'search'
export type FeaturedFilter = 'featured' | 'unfeatured' | 'all'

interface FeedStore {
  shouts: Shout[]
  isLoading: boolean
  hasMore: boolean
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
  initializeFeed: (name: FeedName, shouts: Shout[]) => void
}

const FeedContext = createContext<FeedContextType>({} as FeedContextType)

export const useFeed = () => useContext(FeedContext)

const emptyFeed: FeedStore = { shouts: [], isLoading: false, hasMore: false }

// Добавляем тип для имени фида
export type FeedName = 'recent' | 'hot' | 'top' | 'followed' | 'discussed' | 'coauthored' | 'search'

// Добавляем тип для мапы сеттеров
type FeedSettersMap = {
  [K in FeedName]: Setter<FeedStore>
}

// Добавляем тип для мапы абортконтроллеров
type ControllersMap = {
  [K in FeedName]: AbortController | null
}

export const FeedProvider = (props: { children: JSX.Element }) => {
  console.log('[FeedProvider] Initializing')

  const { client } = useSession()
  const loc = useLocation()
  const [isFeedLoading, setIsFeedLoading] = createSignal(false)
  const [myRates, setMyRates] = createSignal<Record<number, ReactionKind>>({})

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
  const [feedByMode, setFeedByMode] = createSignal<FeedStore>(emptyFeed)
  const mode = createMemo((): FeedMode => {
    const path = loc.pathname
    const currentMode = path.includes('/feed/') ? path.split('/feed/')[1] || 'recent' : 'recent'
    console.log('[FeedProvider] Mode computed:', { path, currentMode })
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
    followed: null,
    discussed: null,
    coauthored: null,
    search: null
  }

  // Создаем мапу сеттеров
  const feedSetters: FeedSettersMap = {
    recent: setRecentFeed,
    hot: setHotFeed,
    top: setTopFeed,
    followed: setFollowedFeed,
    discussed: setDiscussedFeed,
    coauthored: setCoauthoredFeed,
    search: setSearchFeed
  }

  // Modify updateFeed to be more conservative with updates
  const updateFeed = (name: FeedName, shouts: Shout[], opts?: { offset?: number; limit?: number }) => {
    console.log('[FeedProvider] Updating feed:', {
      name,
      shoutsCount: shouts.length,
      opts,
      currentMode: mode()
    })

    const setter = feedSetters[name]
    if (!setter) {
      console.warn('[FeedProvider] No setter found for feed:', name)
      return
    }

    // Create new feed state outside of setter to avoid nested updates
    const existingFeed = setter((prev) => prev)
    const existingIds = new Set(existingFeed.shouts.map((s) => s.id))
    const uniqueShouts = shouts.filter((s) => !existingIds.has(s.id))

    if (uniqueShouts.length === 0 && !opts?.offset) {
      return
    }

    const newShouts = opts?.offset ? [...existingFeed.shouts, ...uniqueShouts] : uniqueShouts
    const newFeed = {
      shouts: newShouts,
      isLoading: false,
      hasMore: shouts.length >= (opts?.limit || FEED_PAGE_SIZE),
      error: undefined
    }

    // Only update if there are actual changes
    if (existingFeed !== newFeed) {
      setter(newFeed)

      // Update feedByMode in next tick if it matches current mode
      if (name === mode()) {
        Promise.resolve().then(() => {
          setFeedByMode(newFeed)
        })
      }
    }

    console.log('[FeedProvider] Feed updated:', {
      name,
      newShoutsCount: newShouts.length,
      hasMore: shouts.length >= (opts?.limit || FEED_PAGE_SIZE)
    })
  }

  // Simplify loadFeed to avoid nested state updates
  const loadFeed = async (name: FeedName, opts?: Partial<LoadShoutsOptions>) => {
    console.log('[FeedProvider] Loading feed:', { name, opts })

    const currentFeed = feedSetters[name]((prev) => prev)
    if (currentFeed.isLoading) {
      console.log('[FeedProvider] Skip loading - already in progress:', name)
      return
    }

    controllers[name]?.abort()
    controllers[name] = new AbortController()

    const setter = feedSetters[name]
    if (!setter) return

    // Set loading state
    setter((prev) => ({ ...prev, isLoading: true }))

    try {
      const result = await loadShouts({
        options: {
          ...options(),
          ...opts,
          order_by: orderByMode(name)
        }
      })()

      console.log('[FeedProvider] Feed loaded:', {
        name,
        resultCount: result?.length,
        opts
      })

      updateFeed(name, result || [], {
        limit: opts?.limit || FEED_PAGE_SIZE,
        offset: opts?.offset || 0
      })
    } catch (error) {
      console.error('[FeedProvider] Error loading feed:', { name, error })
    } finally {
      controllers[name] = null
      setter((prev) => ({ ...prev, isLoading: false }))
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
    try {
      const fetcher = await loadFollowedShouts({ options: { ...options(), ...opts } }, client())
      const result = await fetcher()
      setFollowedFeed((prev: FeedStore) => ({
        shouts: opts?.offset ? [...prev.shouts, ...(result || [])] : result || [],
        isLoading: false,
        hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE)
      }))
    } catch (error) {
      setFollowedFeed((prev) => ({ ...prev, isLoading: false, error: error as Error }))
    }
  }

  const loadDiscussedFeed = async (opts?: Partial<LoadShoutsOptions>) => {
    setDiscussedFeed((prev) => ({ ...prev, isLoading: true }))
    try {
      const fetcher = await loadDiscussedShouts({ options: { ...options(), ...opts } }, client())
      const result = await fetcher()
      setDiscussedFeed((prev: FeedStore) => ({
        shouts: opts?.offset ? [...prev.shouts, ...(result || [])] : result || [],
        isLoading: false,
        hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE)
      }))
    } catch (error) {
      setDiscussedFeed((prev) => ({ ...prev, isLoading: false, error: error as Error }))
    }
  }

  const loadCoauthoredFeed = async (opts?: Partial<LoadShoutsOptions>) => {
    setCoauthoredFeed((prev) => ({ ...prev, isLoading: true }))
    try {
      const fetcher = await loadCoauthoredShouts({ options: { ...options(), ...opts } }, client())
      const result = await fetcher()
      setCoauthoredFeed((prev: FeedStore) => ({
        shouts: opts?.offset ? [...prev.shouts, ...(result || [])] : result || [],
        isLoading: false,
        hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE)
      }))
    } catch (error) {
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
    const currentMode = mode() as FeedName
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
      [mode],
      ([currentMode]) => {
        // Reset states
        setMyRates({})
        updateOptions({ offset: 0 })

        const loadCurrentFeed = () => {
          switch (currentMode) {
            case 'hot':
              return loadHotFeed()
            case 'top':
              return loadTopFeed()
            case 'followed':
              return loadFollowedFeed()
            case 'discussed':
              return loadDiscussedFeed()
            case 'coauthored':
              return loadCoauthoredFeed()
            case 'search':
              return // Search feed is loaded separately
            default:
              return loadRecentFeed()
          }
        }

        Promise.resolve().then(loadCurrentFeed)
      },
      { defer: true }
    )
  )

  // Мемоизируем текущий фид
  const currentFeed = createMemo(() => {
    switch (mode()) {
      case 'hot':
        return hotFeed()
      case 'top':
        return topFeed()
      case 'followed':
        return followedFeed()
      case 'discussed':
        return discussedFeed()
      case 'coauthored':
        return coauthoredFeed()
      case 'search':
        return searchFeed()
      default:
        return recentFeed()
    }
  })

  // Обновляем эффект для feedByMode
  createEffect(() => {
    const feed = currentFeed()
    if (!feedByMode().shouts.includes(feed.shouts[0])) {
      setFeedByMode(feed)
    }
  })

  // Добавляем эффекты для наблюдения за изменением текущего фида и обновления группировок
  createEffect(
    on(
      () => feedByMode().shouts,
      (shouts) => {
        // Группировка по layout
        const groupedByLayout = shouts.reduce(
          (acc, shout) => {
            if (shout.layout) {
              // Проверяем наличие layout
              acc[shout.layout] = acc[shout.layout] || []
              if (acc[shout.layout].indexOf(shout) === -1) {
                acc[shout.layout].push(shout)
              }
            }
            return acc
          },
          {} as Record<string, Shout[]>
        )
        setFeedByLayout(groupedByLayout)

        // Группировка по topic
        const groupedByTopic = shouts.reduce(
          (acc, shout) => {
            if (shout.main_topic) {
              acc[shout.main_topic.slug] = acc[shout.main_topic.slug] || []
              acc[shout.main_topic.slug].push(shout)
            }
            shout.topics?.forEach((topic) => {
              if (topic?.slug && topic?.title) {
                // Проверяем наличие slug и title
                acc[topic.slug] = acc[topic.slug] || []
                if (acc[topic.slug].indexOf(shout) === -1) {
                  acc[topic.slug].push(shout)
                }
              }
            })
            return acc
          },
          {} as Record<string, Shout[]>
        )
        setFeedByTopic(groupedByTopic)

        // Группировка по author
        const groupedByAuthor = shouts.reduce(
          (acc, shout) => {
            if (shout.created_by?.id) {
              acc[shout.created_by.id] = acc[shout.created_by.id] || []
              acc[shout.created_by.id].push(shout)
            }
            shout.authors?.forEach((author) => {
              if (author?.slug && author?.name) {
                // Проверяем наличие slug и name
                acc[author.slug] = acc[author.slug] || []
                if (acc[author.slug].indexOf(shout) === -1) {
                  acc[author.slug].push(shout)
                }
              }
            })
            return acc
          },
          {} as Record<string, Shout[]>
        )
        setFeedByAuthor(groupedByAuthor)
      }
    )
  )

  // Добавим метод для инициализации фида с SSR данными
  const initializeFeed = (name: FeedName, shouts: Shout[]) => {
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
    setFeedByMode(newFeed)

    // Обновляем группировки
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

    // Аналогично обновляем остальные группировки...
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

        // Просмотренные
        seen,
        addSeen,

        // Метод для добавления
        addShoutsToFeed,

        // Добавим метод для инициализации фида с SSR данными
        initializeFeed
      }}
    >
      {props.children}
    </FeedContext.Provider>
  )
}
