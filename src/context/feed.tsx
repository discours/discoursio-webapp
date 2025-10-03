import { useLocation } from '@solidjs/router'
import { Client as GraphQLClient } from '@urql/core'
import {
  Accessor,
  batch,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  JSX,
  on,
  onCleanup,
  Setter,
  useContext
} from 'solid-js'
import { isServer } from 'solid-js/web'
import {
  loadCoauthoredShouts,
  loadDiscussedShouts,
  loadFollowedShouts,
  loadMyFollowedShouts
} from '~/graphql/api/private'
import { loadShouts, loadShoutsSearch } from '~/graphql/api/public'
import { Author, LoadShoutsOptions, ReactionKind, Shout, ShoutsOrderBy, Topic } from '~/graphql/generated/graphql'
import { FeedFilters, FeedMode, FilterState, MyFeedKind } from '~/types/nav'
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
  lastLoaded?: number
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
 * @param isOwnFeed - true для своей ленты (load_shouts_feed), false для чужой (load_shouts_followed_by)
 * @param userSlug - Slug пользователя (только для чужой followed ленты)
 * @param opts - Дополнительные опции (пагинация и т.д.)
 *
 * @throws {Error} При ошибке загрузки
 */
const loadPersonalFeed = async (
  type: 'followed' | 'discussed' | 'coauthored',
  setter: Setter<FeedState>,
  client: GraphQLClient,
  options: LoadShoutsOptions,
  isOwnFeed = true,
  userSlug?: string,
  opts?: Partial<LoadShoutsOptions>
) => {
  setter((prev) => ({ ...prev, isLoading: true }))
  console.log(`[FeedProvider] Loading ${type} feed:`, { opts, isOwnFeed, userSlug })

  try {
    let fetcher: (() => Promise<Shout[] | undefined>) | undefined

    if (type === 'followed') {
      if (isOwnFeed) {
        // 🔥 ДЛЯ СВОЕЙ ЛЕНТЫ: load_shouts_feed (без slug)
        // Возвращает публикации от авторов/тем, на которых подписан ТЕКУЩИЙ пользователь
        fetcher = await loadMyFollowedShouts({ options: { ...options, ...opts } }, client)
      } else if (userSlug) {
        // ДЛЯ ЧУЖОЙ ЛЕНТЫ: load_shouts_followed_by (с slug)
        // Возвращает публикации от авторов/тем, на которых подписан ДРУГОЙ пользователь
        fetcher = await loadFollowedShouts({ options: { ...options, ...opts }, slug: userSlug }, client)
      } else {
        throw new Error('Missing userSlug for other user followed feed')
      }
    } else if (type === 'discussed') {
      fetcher = await loadDiscussedShouts({ options: { ...options, ...opts } }, client)
    } else if (type === 'coauthored') {
      fetcher = await loadCoauthoredShouts({ options: { ...options, ...opts } }, client)
    } else {
      throw new Error(`Unknown feed type: ${type}`)
    }

    const result = await fetcher!()

    console.log(`[FeedProvider] ${type} feed loaded:`, {
      count: result?.length,
      isEmpty: !result?.length,
      hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE)
    })

    setter((prev: FeedState) => ({
      shouts: opts?.offset ? [...prev.shouts, ...(result || [])] : result || [],
      isLoading: false,
      hasMore: (result || []).length >= (opts?.limit || FEED_PAGE_SIZE),
      isEmpty: !result?.length,
      lastLoaded: Date.now()
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

  // ✅ Правильный подход: реактивный сигнал для mode
  const [mode, setMode] = createSignal<FeedMode>('recent')

  // Отслеживаем изменения URL и обновляем mode
  createEffect(() => {
    const path = loc.pathname

    // Определяем режим из URL
    let currentMode: FeedMode = 'recent'

    if (path.startsWith('/feed')) {
      if (path === '/feed') {
        // Если путь именно /feed, используем recent по умолчанию
        currentMode = 'recent'
      } else if (path.startsWith('/feed/')) {
        // Если путь начинается с /feed/, извлекаем режим после слэша
        const modePart = path.split('/feed/')[1]
        if (modePart && modePart !== '') {
          const modeValue = modePart.split('/')[0] // берем только первую часть после /feed/

          // Проверяем что это валидный режим
          const validModes: FeedMode[] = [
            'recent',
            'hot',
            'top',
            'search',
            'comments',
            'about',
            'followed',
            'discussed',
            'coauthored'
          ]
          if (validModes.includes(modeValue as FeedMode)) {
            currentMode = modeValue as FeedMode
          } else {
            // Если режим не валидный, используем recent по умолчанию
            currentMode = 'recent'
          }
        }
      }
    }

    console.log('[FeedProvider] URL mode change:', { path, currentMode, splitResult: path.split('/feed/') })
    setMode(currentMode)
  })

  const [options, setOptions] = createSignal<LoadShoutsOptions>({ limit: FEED_PAGE_SIZE })

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
      error: undefined,
      lastLoaded: Date.now()
    }

    if (existingFeed !== newFeed) {
      setter(newFeed)

      if (name === mode()) {
        void Promise.resolve().then(() => {
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
   * Функция загрузки с учетом фильтров и опций
   *
   * @param mode - Тип ленты для загрузки
   * @param opts - Опции загрузки (limit, offset и т.д.)
   */
  const loadFeed = async (mode: keyof FeedSettersMap, opts?: Partial<LoadShoutsOptions>) => {
    setIsFeedLoading(true)
    const setter = feedSetters[mode]
    if (!setter) return

    // Отменяем предыдущий запрос для этого режима
    if (controllers[mode]) {
      controllers[mode]?.abort()
    }

    // Создаем новый AbortController для этого запроса
    const abortController = new AbortController()
    controllers[mode] = abortController

    try {
      // Объединяем фильтры из filterState с переданными опциями
      const currentFilters = filterState().filters as FeedFilters
      const mergedOptions: LoadShoutsOptions = {
        ...options(),
        ...opts,
        // Устанавливаем правильную сортировку для режима
        order_by: opts?.order_by ?? orderByMode(mode as FeedMode),
        filters: {
          ...currentFilters,
          ...opts?.filters
        }
      }

      const fetcher = loadShouts({ options: mergedOptions })
      const shouts = await fetcher()

      // Проверяем, не был ли запрос отменен
      if (abortController.signal.aborted) {
        return
      }

      if (shouts?.length) {
        updateFeed(mode, shouts as ShoutWithStats[], {
          offset: opts?.offset ?? undefined,
          limit: opts?.limit ?? undefined
        })
      }
    } catch (error) {
      // Игнорируем ошибки отмены
      if (abortController.signal.aborted) {
        return
      }

      console.error(`[FeedProvider] Failed to load ${mode} feed:`, error)
      setter((prev) => ({ ...prev, isLoading: false, error: error as Error }))
    } finally {
      // Очищаем controller только если запрос не был отменен
      if (!abortController.signal.aborted) {
        controllers[mode] = null
        setIsFeedLoading(false)
      }
    }
  }

  const loadRecentFeed = (opts?: Partial<LoadShoutsOptions>) => loadFeed('recent', opts)
  const loadHotFeed = (opts?: Partial<LoadShoutsOptions>) => loadFeed('hot', opts)
  const loadTopFeed = (opts?: Partial<LoadShoutsOptions>) => loadFeed('top', opts)

  // Добавляем отслеживание просмотренных
  const [seen, setSeen] = createSignal<Record<string, number>>({})
  const addSeen = (slug: string) => {
    setSeen((prev) => ({ ...prev, [slug]: Date.now() }))
  }

  // Обновляем методы загрузки персональных лент с передачей client и options
  // 🔥 ИСПРАВЛЕНО: Для СВОЕЙ ленты подписок используем isOwnFeed=true (без slug)
  const loadFollowedFeed = (opts?: Partial<LoadShoutsOptions>) =>
    loadPersonalFeed('followed', setFollowedFeed, client() as GraphQLClient, options(), true, undefined, opts)

  const loadDiscussedFeed = (opts?: Partial<LoadShoutsOptions>) =>
    loadPersonalFeed('discussed', setDiscussedFeed, client() as GraphQLClient, options(), true, undefined, opts)

  const loadCoauthoredFeed = (opts?: Partial<LoadShoutsOptions>) =>
    loadPersonalFeed('coauthored', setCoauthoredFeed, client() as GraphQLClient, options(), true, undefined, opts)

  const loadFeedSearch = async (text: string, options: LoadShoutsOptions) => {
    console.debug('[FeedProvider] loadFeedSearch called with:', { text, options })

    // Set loading state
    setSearchFeed((prev) => ({ ...prev, isLoading: true }))

    try {
      console.debug('[FeedProvider] Calling loadShoutsSearch API...')
      const searchArgs = { text, options }
      console.debug('[FeedProvider] Search args:', searchArgs)
      const result = await loadShoutsSearch(searchArgs)()
      console.debug('[FeedProvider] Search API returned:', {
        resultLength: result?.length,
        hasMore: (result || []).length >= (options.limit || FEED_PAGE_SIZE),
        offset: options.offset
      })

      // If this is a new search (offset is 0), replace the entire list
      // Otherwise, append the new results to the existing list
      setSearchFeed((prev) => ({
        shouts: options.offset ? [...prev.shouts, ...(result || [])] : result || [],
        isLoading: false,
        hasMore: (result || []).length >= (options.limit || FEED_PAGE_SIZE),
        isEmpty: !result?.length && options.offset === 0
      }))
    } catch (error) {
      console.error('[FeedProvider] Search API error:', error)
      setSearchFeed((prev) => ({
        ...prev,
        isLoading: false,
        error: error as Error,
        // Only set isEmpty if this was an initial search
        isEmpty: options.offset === 0 ? true : prev.isEmpty
      }))
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
    if (!setter) {
      console.warn('[FeedProvider] initializeFeed: setter not found for', name)
      return
    }

    // Проверяем, есть ли уже данные в этом фиде
    const currentFeed = setter((prev) => prev)
    if (currentFeed.shouts?.length > 0) {
      console.log('[FeedProvider] initializeFeed: feed already has data for', name, 'skipping initialization')
      return
    }

    console.log('[FeedProvider] initializeFeed:', { name, shoutsLength: shouts.length })

    const newFeed = {
      shouts,
      isLoading: false,
      hasMore: shouts.length >= FEED_PAGE_SIZE,
      isEmpty: false, // Явно указываем что данные есть
      error: undefined,
      lastLoaded: Date.now()
    }

    batch(() => {
      setter(newFeed)
      // Обновляем группировки только если данные новые
      if (shouts.length > 0) {
        setFeedByLayout(groupByLayout(shouts))
        setFeedByTopic(groupByTopic(shouts))
        setFeedByAuthor(groupByAuthor(shouts))
      }
    })

    console.log('[FeedProvider] initializeFeed completed for', name)
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
        return [...shouts].sort((a, b) => Number(b.last_commented_at || 0) - Number(a.last_commented_at || 0))
      case 'top':
        return [...shouts].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      case 'comments':
        return [...shouts].sort((a, b) => Number(b.comments_count || 0) - Number(a.comments_count || 0))
      default:
        return [...shouts].sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))
    }
  }

  /**
   * Эффект для автоматической перезагрузки данных при смене фильтров
   * Перезагружает текущий режим ленты при обновлении фильтров
   */
  createEffect(
    on(
      () => filterState().timestamp,
      (timestamp, prevTimestamp) => {
        // Перезагружаем только если фильтры действительно изменились
        if (timestamp !== prevTimestamp && prevTimestamp !== undefined) {
          const currentMode = mode()
          console.log('[FeedProvider] Filters changed, reloading feed:', currentMode)

          // Сбрасываем feed ДО начала загрузки, чтобы UI сразу обновился
          const setter = feedSetters[currentMode]
          if (setter) {
            setter({
              shouts: [],
              isLoading: true,
              hasMore: false,
              isEmpty: true,
              error: undefined,
              lastLoaded: undefined
            })

            switch (currentMode) {
              case 'hot':
                void loadHotFeed()
                break
              case 'top':
                void loadTopFeed()
                break
              default:
                void loadRecentFeed()
                break
            }
          }
        }
      },
      { defer: true }
    )
  )

  /**
   * Эффект для автоматической загрузки данных при смене режима
   * Загружает данные только если их нет в кеше или они устарели
   */
  createEffect(
    on(
      mode,
      async (currentMode) => {
        console.log('[FeedProvider] Feed mode changed:', currentMode)

        // Сбрасываем состояние при смене режима (группируем операции)
        batch(() => {
          setOptions((prev) => ({ ...prev, offset: 0 }))
          setMyRates({})
        })

        // Определяем тип ленты
        const isPersonalFeed = ['followed', 'discussed', 'coauthored'].includes(currentMode)

        // 🛡️ SSR не загружает авторизованные ленты
        if (isServer && isPersonalFeed) {
          console.log('[FeedProvider] Skipping personal feed load on SSR')
          return
        }

        // Проверяем нужно ли загружать данные
        const currentFeed = feedSetters[currentMode]?.((prev) => prev)
        const hasValidData = currentFeed?.shouts?.length > 0 && !currentFeed.isEmpty

        // Для публичных лент всегда загружаем свежие данные если нет данных или они устарели
        const shouldRefresh =
          !isPersonalFeed &&
          (!hasValidData || !currentFeed?.lastLoaded || Date.now() - currentFeed.lastLoaded > 5 * 60 * 1000)

        // Для персональных лент загружаем только если нет данных
        const shouldLoadPersonal = isPersonalFeed && !hasValidData

        if (!shouldRefresh && !shouldLoadPersonal) {
          console.log(
            `[FeedProvider] ${currentMode} feed has valid data (${currentFeed?.shouts?.length || 0} items), skipping load`
          )
          return
        }

        console.log(`[FeedProvider] Loading ${currentMode} feed...`)

        // Добавляем небольшую задержку для предотвращения race conditions
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Загружаем данные в зависимости от типа
        try {
          if (isPersonalFeed && !client()) {
            console.log('[FeedProvider] Skipping personal feed load - no auth client')
            return
          }

          switch (currentMode) {
            case 'followed':
              await loadFollowedFeed()
              break
            case 'discussed':
              await loadDiscussedFeed()
              break
            case 'coauthored':
              await loadCoauthoredFeed()
              break
            case 'hot':
              await loadHotFeed()
              break
            case 'top':
              await loadTopFeed()
              break
            default:
              await loadRecentFeed()
              break
          }
        } catch (error) {
          console.error(`[FeedProvider] Error loading ${currentMode} feed:`, error)
        }
      },
      { defer: true }
    )
  )

  const feedByMode = createMemo(() => {
    const currentMode = mode()
    const currentMyFeed = myFeed()

    // Приоритет личных лент если пользователь авторизован и выбрал их
    if (currentMyFeed && session()?.token) {
      switch (currentMyFeed) {
        case 'followed':
          return followedFeed()
        case 'discussed':
          return discussedFeed()
        case 'coauthored':
          return coauthoredFeed()
        default:
          break
      }
    }

    // Основные публичные режимы ленты
    switch (currentMode) {
      case 'hot':
        return hotFeed()
      case 'top':
        return topFeed()
      case 'search':
        return searchFeed()
      default:
        return recentFeed()
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
      // 🛡️ SSR не загружает авторизованные ленты
      if (isServer) return

      if (!(session()?.token && currentFeed)) return

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

  // Cleanup для отмены всех pending запросов при размонтировании
  onCleanup(() => {
    // Отменяем все активные запросы при размонтировании
    Object.values(controllers).forEach((controller) => {
      if (controller) {
        controller.abort()
      }
    })
  })

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
