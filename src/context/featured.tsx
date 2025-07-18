import type { JSX } from 'solid-js'
import {
  Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
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

  // Добавляем проверку контекста с детальным логированием
  if (!context || Object.keys(context).length === 0) {
    console.warn('🔍 FeaturedFeed: Контекст не инициализирован, возвращаем безопасные заглушки')
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
  const [randomTopicFeed, setRandomTopicFeed] = createSignal<{ shouts: Shout[]; topic: Topic } | undefined>(
    undefined
  )

  // Флаг инициализации для отслеживания готовности контекста
  const [isInitialized, setIsInitialized] = createSignal(isServer)

  // Безопасное получение randomTopic с проверкой контекста
  const getRandomTopic = () => {
    try {
      const { randomTopic } = useTopics()
      return randomTopic
    } catch (error) {
      console.warn('🔍 FeaturedFeed: Topics контекст недоступен:', error)
      return () => undefined
    }
  }

  const randomTopic = getRandomTopic()

  // Безопасная загрузка данных randomTopicFeed только на клиенте
  createEffect(
    on(
      randomTopic,
      async (t?: Topic) => {
        // Загружаем только если есть топик и мы на клиенте
        if (!t || isServer) {
          console.log('🔍 FeaturedFeed: Пропускаем загрузку randomTopicFeed на сервере или без топика')
          return
        }

        try {
          console.log('🔍 FeaturedFeed: Загружаем randomTopicFeed для топика:', t.slug)

          const shoutsLoader = await loadShouts({
            options: {
              filters: { topic: t.slug, featured: true },
              limit: RANDOM_TOPIC_SHOUTS_COUNT,
              offset: 0
            }
          })

          const shouts = await shoutsLoader()

          if (shouts && shouts.length > 0) {
            setRandomTopicFeed({ shouts, topic: t })
            console.log('🔍 FeaturedFeed: randomTopicFeed загружен успешно:', shouts.length, 'публикаций')
          } else {
            console.log('🔍 FeaturedFeed: randomTopicFeed пуст для топика:', t.slug)
            setRandomTopicFeed(undefined)
          }
        } catch (error) {
          console.error('🔍 FeaturedFeed: Ошибка загрузки randomTopicFeed:', error)
          setRandomTopicFeed(undefined)
        }
      },
      { defer: true } // Важно: defer для предотвращения выполнения на SSR
    )
  )

  // Отмечаем инициализацию после монтирования
  createEffect(() => {
    if (!isServer) {
      setIsInitialized(true)
      console.log('🔍 FeaturedFeed: Контекст инициализирован на клиенте')
    }
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

  return <FeaturedFeedContext.Provider value={contextValue}>{props.children}</FeaturedFeedContext.Provider>
}
