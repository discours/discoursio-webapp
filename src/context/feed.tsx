import { useLocation } from '@solidjs/router'
import {
  Accessor,
  JSX,
  Setter,
  batch,
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

// Обновляем тип FeedSettersMap чтобы включить все вможные значения FeedMode
type FeedSettersMap = {
  [K in FeedMode]: Setter<FeedStore>
}

// Выносим функции группировки на уровень модуля
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

// Добавим типы для полей Shout с дополнительной статистикой
interface ShoutStats {
  last_commented_at: Date | null
  rating: number
  comments_count: number
  created_at: Date
}

type ShoutWithStats = Shout & ShoutStats

// Обовляем тип ControllersMap для всех возможных значений FeedMode
type ControllersMap = {
  [K in FeedMode]: AbortController | null
}

/**
 * FeedProvider - основной контекст для управления лентами постов
 *
 * Возможности:
 * - Управление разными типами лент (hot, top, recent)
 * - Персональные ленты (followed, discussed, coauthored)
 * - Группировка постов по layout/topic/author
 * - Кэширование и предотвращение повторных загрузок
 *
 * @example
 * ```tsx
 * <FeedProvider>
 *   <FeedView />
 * </FeedProvider>
 * ```
 */
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

  // Обновляем инициализацию feedSetters
  const feedSetters: FeedSettersMap = {
    recent: setRecentFeed,
    hot: setHotFeed,
    top: setTopFeed,
    search: setSearchFeed,
    comments: setRecentFeed,
    about: setRecentFeed,
    followed: setFollowedFeed,
    discussed: setDiscussedFeed,
    coauthored: setCoauthoredFeed
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

  // Создаем мапу абортконтроллеров
  const controllers: ControllersMap = {
    recent: null,
    hot: null,
    top: null,
    search: null,
    comments: null,
    about: null,
    followed: null,
    discussed: null,
    coauthored: null
  }

  /**
   * Загрузка ленты с обработкой ошибок и состояний
   *
   * @param {FeedMode} name - Тип ленты для загрузки
   * @param {Partial<LoadShoutsOptions>} opts - Опции загрузки
   *
   * @example
   * ```ts
   * await loadFeed('hot', { limit: 20, offset: 0 })
   * ```
   */
  const loadFeed = async (name: FeedMode, opts?: Partial<LoadShoutsOptions>) => {
    controllers[name]?.abort()
    controllers[name] = new AbortController()

    const setter = feedSetters[name]
    if (!setter) return

    setter((prev: FeedStore) => ({
      ...prev,
      isLoading: true,
      error: undefined
    }))

    try {
      const result = await loadShouts({
        options: {
          ...options(),
          ...opts,
          order_by: orderByMode(name)
        }
      })(controllers[name]?.signal)

      setter({
        shouts: result || [],
        isLoading: false,
        hasMore: (result?.length || 0) >= (opts?.limit || FEED_PAGE_SIZE),
        isEmpty: !result?.length,
        error: undefined
      })
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return
      setter((prev: FeedStore) => ({
        ...prev,
        isLoading: false,
        error: error as Error
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

  // Используем updateFeed в addShoutsToFeed
  const addShoutsToFeed = (shouts: Shout[]) => {
    const currentMode = mode() as FeedMode
    updateFeed(currentMode, shouts as ShoutWithStats[])
  }

  /**
   * Эффект для предотвращения циклических обновлений при смене режима
   *
   * Особенности:
   * - Использует batch для группировки обновлений
   * - Откладывает загрузку через Promise.resolve()
   * - Предотвращает циклы через defer: true
   */
  createEffect(
    on(
      mode, // Слушаем только изменение режима
      (currentMode) => {
        console.log('[FeedProvider] Feed mode changed:', {
          mode: currentMode,
          client: !!client()
        })

        // Определяем тип ленты
        const isPersonalFeed = ['followed', 'discussed', 'coauthored'].includes(currentMode)

        // Сначала загружаем новые данные
        const loadPromise = Promise.resolve().then(() => {
          if (isPersonalFeed && !client()) return

          switch (currentMode) {
            case 'followed':
              return loadFollowedFeed()
            case 'discussed':
              return loadDiscussedFeed()
            case 'coauthored':
              return loadCoauthoredFeed()
            case 'hot':
              return loadHotFeed()
            case 'top':
              return loadTopFeed()
            default:
              return loadRecentFeed()
          }
        })

        // Только после загрузки очищаем старые данные
        loadPromise.then(() => {
          batch(() => {
            setMyRates({})
            updateOptions({ offset: 0 })
            // Очищаем ленты...
          })
        })
      },
      { defer: true }
    )
  )

  // Было - создание объекта при каждом вычислении (React style)
  const feeds: Record<FeedMode, Accessor<FeedStore>> = {
    hot: hotFeed,
    top: topFeed,
    recent: recentFeed,
    search: searchFeed,
    comments: recentFeed,
    about: recentFeed,
    followed: followedFeed,
    discussed: discussedFeed,
    coauthored: coauthoredFeed
  }

  const feedByMode = createMemo(() => {
    const currentMode = mode()
    return feeds[currentMode]() || recentFeed()
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

  /**
   * Инициализация ленты данными от SSR
   *
   * Особенности:
   * - Синхронная установка данных
   * - Обновление всех группировок
   * - Предотвращение лишних ререндеров
   *
   * @param {FeedMode} name - Тип ленты
   * @param {Shout[]} shouts - Посты для инициали��ации
   */
  const initializeFeed = (name: keyof FeedSettersMap, shouts: Shout[]) => {
    const setter = feedSetters[name]
    if (!setter) return

    const newFeed = {
      shouts,
      isLoading: false,
      hasMore: shouts.length >= FEED_PAGE_SIZE,
      error: undefined
    }

    // станавливаем значения синхронно
    setter(newFeed)
    setter(newFeed)

    // Обновляем гуппровки
    setFeedByLayout(groupByLayout(shouts))

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

  // Добаляем фильры в зачение контекста
  const [filterState, setFilterState] = createSignal<FilterState>({ filters: {}, timestamp: Date.now() })
  const updateFilters = (filters: Partial<FeedFilters>) => {
    setFilterState((prev) => ({
      filters: { ...prev.filters, ...filters },
      timestamp: Date.now()
    }))
  }

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
