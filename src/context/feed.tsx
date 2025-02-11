import { useLocation } from '@solidjs/router'
import { Client as GraphQLClient } from '@urql/core'
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
import {
  Author,
  LoadShoutsOptions,
  ReactionKind,
  Shout,
  ShoutsOrderBy,
  Topic
} from '~/graphql/schema/core.gen'
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

/**
 * Тип для хранения состояния ленты
 * @property shouts - Массив постов
 * @property isLoading - Флаг загрузки
 * @property hasMore - Есть ли еще посты для загрузки
 * @property isEmpty - Пустая ли лента
 * @property error - Ошибка при загрузке
 */
interface FeedState {
  shouts: Shout[]
  isLoading: boolean
  hasMore: boolean
  isEmpty?: boolean
  error?: Error
}

interface FeedContextType {
  // Основные хранилища
  recentFeed: Accessor<FeedState>
  hotFeed: Accessor<FeedState>
  topFeed: Accessor<FeedState>

  // Дополнительные хранилища для других видов выборок
  followedFeed: Accessor<FeedState>
  discussedFeed: Accessor<FeedState>
  coauthoredFeed: Accessor<FeedState>
  searchFeed: Accessor<FeedState>

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
  feedByMode: Accessor<FeedState>
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

  // Добавляем сеттеры для персональных лент
  setFollowedFeed: Setter<FeedState>
  setDiscussedFeed: Setter<FeedState>
  setCoauthoredFeed: Setter<FeedState>
}

const FeedContext = createContext<FeedContextType>({} as FeedContextType)

export const useFeed = () => useContext(FeedContext)

const emptyFeed: FeedState = { shouts: [], isLoading: false, hasMore: false }

// Обновляем тип FeedSettersMap чтобы включить все возможные значения FeedMode
type FeedSettersMap = {
  [K in FeedMode]: Setter<FeedState>
}

/**
 * Универсальная функция для группировки постов по заданному ключу
 *
 * @template T - Тип элемента (наследуется от Shout)
 * @param items - Массив элементов для группировки
 * @param getKey - Функция получения ключа для группировки
 * @param getItems - Опциональная функция для получения вложенных элементов
 * @returns Record с сгруппированными элементами
 *
 * @example
 * ```ts
 * const byTopic = groupBy(shouts,
 *   shout => shout.main_topic?.slug,
 *   shout => shout.topics
 * )
 * ```
 */
const groupBy = <T extends Shout, S extends { slug?: string } | { id?: number | string }>(
  items: T[],
  getKey: (item: T) => string | undefined,
  getItems?: (item: T) => S[]
): Record<string, T[]> => {
  return items.reduce(
    (acc, item) => {
      const processItem = (key: string | undefined, i: T) => {
        if (key) {
          acc[key] = acc[key] || []
          acc[key].push(i)
        }
      }

      processItem(getKey(item), item)
      if (getItems) {
        getItems(item).forEach((subItem) => {
          const key =
            'slug' in subItem && subItem.slug
              ? subItem.slug
              : 'id' in subItem && subItem.id
                ? subItem.id.toString()
                : undefined
          processItem(key, item)
        })
      }

      return acc
    },
    {} as Record<string, T[]>
  )
}

// Теперь используем обновленную функцию
const groupByTopic = (shouts: Shout[]) =>
  groupBy(
    shouts,
    (shout) => shout.main_topic?.slug,
    (shout) => (shout.topics || []).filter((t): t is Topic => !!t)
  )

const groupByAuthor = (shouts: Shout[]) =>
  groupBy(
    shouts,
    (shout) => shout.created_by?.id?.toString(),
    (shout) => (shout.authors || []).filter((a): a is Author => !!a)
  )

const groupByLayout = (shouts: Shout[]) => groupBy(shouts, (shout) => shout.layout)

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
 * Загрузчик для персональных лент (подписки, обсуждения, соавторство)
 *
 * @param type - Тип персональной ленты
 * @param setter - Функция обновления состояния
 * @param client - GraphQL клиент
 * @param options - Базовые опции загрузки
 * @param opts - Дополнительные опции (пагинация и т.д.)
 *
 * @throws {Error} При ошибке загрузки
 */
const loadPersonalFeed = async (
  type: 'followed' | 'discussed' | 'coauthored',
  setter: Setter<FeedState>,
  client: GraphQLClient,
  options: LoadShoutsOptions,
  opts?: Partial<LoadShoutsOptions>
) => {
  setter((prev) => ({ ...prev, isLoading: true }))
  console.log(`[FeedProvider] Loading ${type} feed:`, { opts })

  try {
    const loaders = {
      followed: loadFollowedShouts,
      discussed: loadDiscussedShouts,
      coauthored: loadCoauthoredShouts
    }

    const fetcher = await loaders[type]({ options: { ...options, ...opts } }, client)
    const result = await fetcher()

    console.log(`[FeedProvider] ${type} feed loaded:`, {
      count: result?.length,
      isEmpty: !result?.length,
      hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE)
    })

    setter((prev: FeedState) => ({
      shouts: opts?.offset ? [...prev.shouts, ...(result || [])] : result || [],
      isLoading: false,
      hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE),
      isEmpty: !result?.length
    }))
  } catch (error) {
    console.error(`[FeedProvider] Failed to load ${type} feed:`, error)
    setter((prev) => ({ ...prev, isLoading: false, error: error as Error }))
  }
}

/**
 * Основной провайдер для управления лентами постов
 *
 * Возможности:
 * - Управление разными типами лент (hot, top, recent)
 * - Персональные ленты (followed, discussed, coauthored)
 * - Группировка постов по layout/topic/author
 * - Кэширование и предотвращение повторных загрузок
 * - Синхронизация с URL
 * - Обработка ошибок и состояний загрузки
 *
 * @example
 * ```tsx
 * <FeedProvider>
 *   <FeedView />
 * </FeedProvider>
 * ```
 */
export const FeedProvider = (props: { children: JSX.Element }) => {
  const { session, client } = useSession()
  const loc = useLocation()
  const [isFeedLoading, setIsFeedLoading] = createSignal(false)
  const [myRates, setMyRates] = createSignal<Record<number, ReactionKind>>({})
  const [myFeed, setMyFeed] = createSignal<MyFeedKind>()

  // Создаем отдельные хранилища для каждого типа выборки
  const [recentFeed, setRecentFeed] = createSignal<FeedState>(emptyFeed)
  const [hotFeed, setHotFeed] = createSignal<FeedState>(emptyFeed)
  const [topFeed, setTopFeed] = createSignal<FeedState>(emptyFeed)
  const [followedFeed, setFollowedFeed] = createSignal<FeedState>(emptyFeed)
  const [discussedFeed, setDiscussedFeed] = createSignal<FeedState>(emptyFeed)
  const [coauthoredFeed, setCoauthoredFeed] = createSignal<FeedState>(emptyFeed)
  const [searchFeed, setSearchFeed] = createSignal<FeedState>(emptyFeed)

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

    const existingFeed = setter((prev: FeedState) => prev)
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
   * Особенности:
   * - Отмена предыдущих запросов
   * - Обработка ошибок
   * - Управление состоянием загрузки
   * - Поддержка пагинации
   *
   * @param name - Тип ленты для загрузки
   * @param opts - Опции загрузки (limit, offset и т.д.)
   */
  const loadFeed = async (name: FeedMode, opts?: Partial<LoadShoutsOptions>) => {
    controllers[name]?.abort()
    controllers[name] = new AbortController()

    const setter = feedSetters[name]
    if (!setter) return

    setter((prev: FeedState) => ({
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
      setter((prev: FeedState) => ({
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

  // Обновляем методы загрузки персональных лент с передачей client и options
  const loadFollowedFeed = (opts?: Partial<LoadShoutsOptions>) =>
    loadPersonalFeed('followed', setFollowedFeed, client() as GraphQLClient, options(), opts)

  const loadDiscussedFeed = (opts?: Partial<LoadShoutsOptions>) =>
    loadPersonalFeed('discussed', setDiscussedFeed, client() as GraphQLClient, options(), opts)

  const loadCoauthoredFeed = (opts?: Partial<LoadShoutsOptions>) =>
    loadPersonalFeed('coauthored', setCoauthoredFeed, client() as GraphQLClient, options(), opts)

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
   * Инициализация ленты данными от SSR
   *
   * Особенности:
   * - Синхронная установка данных
   * - Обновление всех группировок
   * - Предотвращение лишних ререндеров
   * - Батчинг обновлений состояния
   *
   * @param name - Тип ленты
   * @param shouts - Посты для инициализации
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

    batch(() => {
      setter(newFeed)
      setFeedByLayout(groupByLayout(shouts))
      setFeedByTopic(groupByTopic(shouts))
      setFeedByAuthor(groupByAuthor(shouts))
    })
  }

  // Добаляем фильры в зачение контекста
  const [filterState, setFilterState] = createSignal<FilterState>({ filters: {}, timestamp: Date.now() })
  const updateFilters = (filters: Partial<FeedFilters>) => {
    setFilterState((prev) => ({
      filters: { ...prev.filters, ...filters },
      timestamp: Date.now()
    }))
  }

  /**
   * Сортировка постов в зависимости от режима отображения
   *
   * @param shouts - Массив постов для сортировки
   * @param mode - Режим сортировки (hot/top/comments/recent)
   * @returns Отсортированный массив постов
   */
  const sortShouts = (shouts: ShoutWithStats[], mode: FeedMode) => {
    if (!shouts?.length) return []

    switch (mode) {
      case 'hot':
        return [...shouts].sort(
          (a, b) => Number(b.last_commented_at || 0) - Number(a.last_commented_at || 0)
        )
      case 'top':
        return [...shouts].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      case 'comments':
        return [...shouts].sort((a, b) => Number(b.comments_count || 0) - Number(a.comments_count || 0))
      default:
        return [...shouts].sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
    }
  }

  /**
   * Эффект для предотвращения циклических обновлений при смене режима
   *
   * Особенности:
   * - Использует batch для группировки обновлений
   * - Откладывает загрузку через Promise.resolve()
   * - Предотвращает циклы через defer: true
   * - Очищает старые данные только после успешной загрузки новых
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

  const feedByMode = createMemo(() => {
    const currentMode = myFeed()
    switch (currentMode) {
      case 'followed':
        return followedFeed()
      case 'discussed':
        return discussedFeed()
      case 'coauthored':
        return coauthoredFeed()
      default:
        switch (mode()) {
          case 'hot':
            return hotFeed()
          case 'top':
            return topFeed()
          default:
            return recentFeed()
        }
    }
  })

  /**
   * Эффект для автоматической загрузки персональной ленты
   *
   * Срабатывает при:
   * - Изменении типа персональной ленты
   * - Наличии авторизации
   *
   * Обеспечивает:
   * - Загрузку соответствующих данных
   * - Обработку состояния загрузки
   * - Очистку при отсутствии авторизации
   */
  createEffect(
    on(myFeed, async (currentFeed) => {
      if (!(session()?.access_token && currentFeed)) return

      setIsFeedLoading(true)
      try {
        switch (currentFeed) {
          case 'followed': {
            await loadFollowedFeed()
            break
          }
          case 'discussed': {
            await loadDiscussedFeed()
            break
          }
          case 'coauthored': {
            await loadCoauthoredFeed()
            break
          }
          default: {
            await loadRecentFeed()
            break
          }
        }
      } finally {
        setIsFeedLoading(false)
      }
    })
  )

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
        setMyFeed,

        // Добавляем сеттеры в значение контекста
        setFollowedFeed,
        setDiscussedFeed,
        setCoauthoredFeed
      }}
    >
      {props.children}
    </FeedContext.Provider>
  )
}
