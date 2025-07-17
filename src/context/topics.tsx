import { Accessor, Component, createContext, createEffect, createResource, JSX, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import { loadTopics, loadTopicsByCommunity } from '~/graphql/api/public'
import { QueryGet_Topics_By_CommunityArgs, Topic } from '~/graphql/generated/graphql'
import { byTopicStatDesc } from '../utils/sort'
import { getRandomItemsFromArray } from '~/utils/random'

export const TOPICS_PER_PAGE = 50

// Стабильные топики по умолчанию для навигации
export const DEFAULT_NAV_TOPICS = [
  'interview',
  'reportage',
  'empiric',
  'society',
  'culture',
  'theory',
  'poetry'
]

type TopicsContextType = {
  topicEntities: Accessor<{ [topicSlug: string]: Topic }>
  sortedTopics: Accessor<Topic[]>
  randomTopic: Accessor<Topic | undefined>
  topTopics: () => Topic[]
  setTopicsSort: (sortBy: string) => void
  addTopics: (topics: Topic[]) => void
  loadTopics: () => Promise<Topic[] | undefined>
  loadMoreTopics: () => Promise<Topic[] | undefined>
  hasMore: Accessor<boolean>
  isLoading: Accessor<boolean>
  topicsByAuthors: Accessor<Topic[]>
  topicsByShouts: Accessor<Topic[]>
  // Стабильные случайные топики для навигации
  randomNavTopics: Accessor<string[]>
}

const TopicsContext = createContext<TopicsContextType>({
  topicEntities: () => ({}) as Record<string, Topic>,
  sortedTopics: () => [] as Topic[],
  topTopics: () => [] as Topic[],
  setTopicsSort: (_s: string) => undefined,
  addTopics: (_ttt: Topic[]) => undefined,
  loadTopics: async () => [] as Topic[],
  loadMoreTopics: async () => [] as Topic[],
  randomTopic: () => undefined,
  hasMore: () => false,
  isLoading: () => false,
  topicsByAuthors: () => [] as Topic[],
  topicsByShouts: () => [] as Topic[],
  randomNavTopics: () => [] as string[]
} as TopicsContextType)

export function useTopics() {
  return useContext(TopicsContext)
}

export type TopicSort = 'shouts' | 'followers' | 'authors' | 'title'

/**
 * Оптимизированная загрузка топиков - используем только один источник данных
 * @returns Промис с массивом топиков
 */
async function loadTopicsOptimized(): Promise<Topic[]> {
  try {
    // Используем только один источник данных - новое API с актуальной статистикой
    const options: QueryGet_Topics_By_CommunityArgs = {
      community_id: 1,
      limit: 200, // загружаем больше данных за один раз
      offset: 0
    }

    const topicsLoader = loadTopicsByCommunity(options)
    const topics = (await topicsLoader()) || []

    return topics
  } catch (error) {
    console.error('Failed to load topics:', error)
    // В случае ошибки пробуем старое API
    try {
      const fallbackLoader = loadTopics()
      return (await fallbackLoader()) || []
    } catch (fallbackError) {
      console.error('Fallback topics loading failed:', fallbackError)
      return []
    }
  }
}

// Оптимизированная реализация провайдера
export const TopicsProvider: Component<{ children: JSX.Element }> = (props) => {
  const [state, setState] = createStore({
    entities: {} as Record<string, Topic>,
    sorted: [] as Topic[],
    sortBy: 'shouts' as TopicSort,
    random: undefined as Topic | undefined,
    loading: false, // начинаем с false - загрузка будет только при необходимости
    error: undefined as Error | undefined,
    offset: 0,
    limit: TOPICS_PER_PAGE,
    hasMore: true,
    byAuthors: [] as Topic[],
    byShouts: [] as Topic[],
    initialized: false, // флаг инициализации
    // Стабильные случайные топики для TopicsNav
    randomNavTopics: [] as string[]
  })

  // Ленивая инициализация - загружаем данные только при первом запросе
  const [topics, { refetch }] = createResource<Topic[], { sortBy: TopicSort; force?: boolean }>(
    () => (state.initialized ? { sortBy: state.sortBy } : null), // возвращаем null пока не инициализирован
    async ({ sortBy }) => {
      try {
        setState('loading', true)

        // Упрощенная загрузка данных
        const result = await loadTopicsOptimized()

        // Применяем сортировку к результату только один раз
        setState('initialized', true)
        return result.sort(byTopicStatDesc(sortBy) as (a: Topic, b: Topic) => number)
      } catch (error) {
        console.error('Failed to load topics:', error)
        setState('error', error as Error)
        return []
      } finally {
        setState('loading', false)
      }
    }
  )

  // Ресурс для пагинации топиков из сообщества
  const [communityTopics, { refetch: refetchCommunityTopics }] = createResource<
    Topic[],
    { offset: number; limit: number }
  >(
    () => (state.offset > 0 ? { offset: state.offset, limit: state.limit } : null),
    async ({ offset, limit }) => {
      try {
        setState('loading', true)

        const options: QueryGet_Topics_By_CommunityArgs = {
          community_id: 1,
          limit,
          offset
        }

        const topicsLoader = loadTopicsByCommunity(options)
        const newData = await topicsLoader()

        setState('hasMore', (newData?.length || 0) >= limit)
        return newData || []
      } catch (error) {
        console.error('Failed to load community topics:', error)
        setState('hasMore', false)
        return []
      } finally {
        setState('loading', false)
      }
    },
    { initialValue: [] }
  )

  // Оптимизированный эффект для обработки основных топиков
  createEffect(() => {
    const newTopics = topics()
    if (!newTopics?.length) return

    setState((prev) => {
      // Создаем entities один раз
      const entities: Record<string, Topic> = {}

      // Заполняем entities без лишних операций
      newTopics.forEach((topic) => {
        if (topic?.slug) {
          entities[topic.slug] = topic
        }
      })

      // Предварительно фильтруем топики для разных сортировок
      const topicsWithAuthors: Topic[] = []
      const topicsWithShouts: Topic[] = []

      newTopics.forEach((topic) => {
        if (topic.stat?.authors && topic.stat.authors > 0) {
          topicsWithAuthors.push(topic)
        }
        if (topic.stat?.shouts && topic.stat.shouts > 0) {
          topicsWithShouts.push(topic)
        }
      })

      // Сортируем только один раз для каждого типа
      const byAuthors = topicsWithAuthors.sort(byTopicStatDesc('authors') as (a: Topic, b: Topic) => number)
      const byShouts = topicsWithShouts.sort(byTopicStatDesc('shouts') as (a: Topic, b: Topic) => number)

      // Генерируем стабильные случайные топики для навигации
      // только если их еще нет (при первой загрузке)
      let randomNavTopics = prev.randomNavTopics
      if (!randomNavTopics.length) {
        const availableTopicSlugs = newTopics.map((t) => t.slug).filter(Boolean)
        if (availableTopicSlugs.length > 0) {
          // Используем детерминированный подход: берем первые 7 топиков вместо случайных
          // для стабильности между сессиями навигации
          randomNavTopics = availableTopicSlugs.slice(0, 7)
        } else {
          randomNavTopics = DEFAULT_NAV_TOPICS
        }
      }

      return {
        ...prev,
        entities,
        sorted: newTopics, // уже отсортировано в ресурсе
        byAuthors,
        byShouts,
        random: prev.random || newTopics[0],
        loading: false,
        randomNavTopics
      }
    })
  })

  // Оптимизированный эффект для пагинации
  createEffect(() => {
    const newTopics = communityTopics()
    if (!newTopics?.length) return

    setState((prev) => {
      // Обновляем entities
      const entities = { ...prev.entities }
      newTopics.forEach((topic) => {
        if (topic?.slug) {
          entities[topic.slug] = topic
        }
      })

      // Обновляем только нужный список в зависимости от текущей сортировки
      let byAuthors = prev.byAuthors
      let byShouts = prev.byShouts

      if (prev.sortBy === 'authors') {
        const newAuthorsTopics = newTopics.filter((t) => t.stat?.authors && t.stat.authors > 0)
        byAuthors = [...prev.byAuthors, ...newAuthorsTopics].sort(
          byTopicStatDesc('authors') as (a: Topic, b: Topic) => number
        )
      } else if (prev.sortBy === 'shouts') {
        const newShoutsTopics = newTopics.filter((t) => t.stat?.shouts && t.stat.shouts > 0)
        byShouts = [...prev.byShouts, ...newShoutsTopics].sort(
          byTopicStatDesc('shouts') as (a: Topic, b: Topic) => number
        )
      }

      // Обновляем основной отсортированный список
      const allTopics = Object.values(entities) as Topic[]
      const sorted = allTopics.sort(byTopicStatDesc(prev.sortBy) as (a: Topic, b: Topic) => number)

      return {
        ...prev,
        entities,
        sorted,
        byAuthors,
        byShouts,
        loading: false
      }
    })
  })

  const value: TopicsContextType = {
    topicEntities: () => state.entities,
    sortedTopics: () => state.sorted,
    randomTopic: () => state.random,
    topTopics: () => state.sorted.slice(0, 10),
    hasMore: () => state.hasMore,
    isLoading: () => state.loading,
    topicsByAuthors: () => state.byAuthors,
    topicsByShouts: () => state.byShouts,
    randomNavTopics: () => state.randomNavTopics,
    setTopicsSort: (sortBy) => {
      setState('sortBy', sortBy as TopicSort)
      setState('offset', 0)
      setState('initialized', true) // инициализируем при первом вызове
      refetch()
    },
    addTopics: (newTopics) =>
      setState((prev) => {
        // Простое обновление entities
        const entities = { ...prev.entities }
        newTopics.forEach((topic) => {
          if (topic?.slug) {
            entities[topic.slug] = topic
          }
        })
        return { ...prev, entities }
      }),
    loadTopics: async () => {
      setState('initialized', true) // инициализируем при первом вызове
      const result = await refetch()
      return result || []
    },
    loadMoreTopics: async () => {
      if (!state.hasMore || state.loading) return []

      setState('offset', state.offset + state.limit)
      const result = await refetchCommunityTopics()
      return result || []
    }
  }

  return <TopicsContext.Provider value={value}>{props.children}</TopicsContext.Provider>
}
