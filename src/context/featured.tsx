import type { JSX } from 'solid-js'
import {
  Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Setter,
  useContext
} from 'solid-js'
import { isServer } from 'solid-js/web'
import { RANDOM_TOPIC_SHOUTS_COUNT } from '~/constants/pagination'
import { loadShouts } from '~/graphql/api/public'
import { Shout, Topic } from '~/graphql/generated/graphql'
import { byStat } from '../utils/sort'
import { FEED_PAGE_SIZE } from './feed'
import { useTopics } from './topics'

type FeaturedFeedContextType = {
  featuredFeed: Accessor<Shout[] | undefined>
  setFeaturedFeed: Setter<Shout[] | undefined>
  topMonthFeed: Accessor<Shout[] | undefined>
  setTopMonthFeed: Setter<Shout[] | undefined>
  topFeed: Accessor<Shout[] | undefined>
  setTopFeed: Setter<Shout[] | undefined>
  topViewedFeed: Accessor<Shout[] | undefined>
  topCommentedFeed: Accessor<Shout[] | undefined>
  setTopCommentedFeed: Setter<Shout[] | undefined>
  randomTopicFeed: Accessor<{ shouts: Shout[]; topic: Topic } | undefined>
  setRandomTopicFeed: Setter<{ shouts: Shout[]; topic: Topic } | undefined>
  isInitialized: Accessor<boolean>
}

const FeaturedFeedContext = createContext<FeaturedFeedContextType>({} as FeaturedFeedContextType)

export const useFeaturedFeed = () => {
  const context = useContext(FeaturedFeedContext)

  // Простая проверка контекста
  if (!context || Object.keys(context).length === 0) {
    if (import.meta.env.DEV) {
      console.warn('useFeaturedFeed: Context not available - component may be outside provider')
    }

    return {
      featuredFeed: () => undefined,
      setFeaturedFeed: () => {},
      topMonthFeed: () => undefined,
      setTopMonthFeed: () => {},
      topFeed: () => undefined,
      setTopFeed: () => {},
      topViewedFeed: () => [],
      topCommentedFeed: () => undefined,
      setTopCommentedFeed: () => {},
      randomTopicFeed: () => undefined,
      setRandomTopicFeed: () => {},
      isInitialized: () => false
    }
  }

  return context
}

export const FeaturedFeedProvider = (props: { children: JSX.Element }) => {
  const [featuredFeed, setFeaturedFeed] = createSignal<Shout[] | undefined>(undefined)
  const [topMonthFeed, setTopMonthFeed] = createSignal<Shout[] | undefined>(undefined)
  const [topFeed, setTopFeed] = createSignal<Shout[] | undefined>(undefined)
  const [topCommentedFeed, setTopCommentedFeed] = createSignal<Shout[] | undefined>(undefined)

  // Инициализируем с undefined для стабильной гидрации
  const [randomTopicFeed, setRandomTopicFeed] = createSignal<{ shouts: Shout[]; topic: Topic } | undefined>(undefined)

  // Флаг инициализации для отслеживания готовности контекста
  const [isInitialized, setIsInitialized] = createSignal(isServer)

  // Правильный порядок загрузки: 1) топики, 2) выбор случайного, 3) загрузка постов один раз

  // Безопасное получение контекста топиков
  const getTopicsContext = () => {
    try {
      return useTopics()
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('FeaturedFeed: Topics контекст недоступен:', error)
      }
      return null
    }
  }

  const topicsContext = getTopicsContext()

  onMount(() => {
    // Только на клиенте, после монтирования DOM
    if (isServer || !topicsContext) {
      return
    }

    // Запускаем загрузку асинхронно
    void loadRandomTopicFeed()
  })

  // Отдельная функция для асинхронной загрузки (не в эффекте!)
  const loadRandomTopicFeed = async () => {
    try {
      // 1. Загружаем топики если их нет
      const topics = await topicsContext!.loadTopics()

      if (!topics || topics.length === 0) {
        return
      }

      // 2. Выбираем первый топик для стабильности
      const randomTopic = topics[0]

      if (!randomTopic?.slug) {
        return
      }

      // 3. Загружаем посты для случайного топика
      const shoutsLoader = await loadShouts({
        options: {
          filters: { topic: randomTopic.slug, featured: true },
          limit: RANDOM_TOPIC_SHOUTS_COUNT,
          offset: 0
        }
      })

      const shouts = await shoutsLoader()

      if (shouts && shouts.length > 0) {
        setRandomTopicFeed({ shouts, topic: randomTopic })
      }
    } catch (error) {
      // Логируем ошибки только в dev режиме
      if (import.meta.env.DEV) {
        console.warn('FeaturedFeed: Ошибка загрузки randomTopicFeed:', error)
      }
      setRandomTopicFeed(undefined)
    }
  }

  // Отмечаем инициализацию после монтирования
  createEffect(() => {
    if (!isServer) {
      setIsInitialized(true)
    }
  })

  // Очистка состояния при размонтировании
  onCleanup(() => {
    setRandomTopicFeed(undefined)
    setIsInitialized(false)
  })

  const topViewedFeed = createMemo(() => {
    const feed = featuredFeed()
    if (!feed?.length) return []
    return [...feed].sort(byStat('viewed') as (a: Shout, b: Shout) => number).slice(0, FEED_PAGE_SIZE)
  })

  const contextValue = {
    featuredFeed,
    setFeaturedFeed,
    topMonthFeed,
    setTopMonthFeed,
    topFeed,
    setTopFeed,
    topViewedFeed,
    topCommentedFeed,
    setTopCommentedFeed,
    randomTopicFeed,
    setRandomTopicFeed,
    isInitialized
  }

  return (
    <FeaturedFeedContext.Provider value={contextValue}>
      <div data-featured-feed-provider style={{ display: 'contents' }}>
        {props.children}
      </div>
    </FeaturedFeedContext.Provider>
  )
}
