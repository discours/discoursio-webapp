import { Accessor, Component, JSX, createContext, createEffect, createResource, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import { loadTopics, loadTopicsByCommunity } from '~/graphql/api/public'
import { QueryGet_Topics_By_CommunityArgs, Topic } from '~/graphql/schema/core.gen'
import { byTopicStatDesc } from '../utils/sort'

export const TOPICS_PER_PAGE = 50

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
  topicsByShouts: () => [] as Topic[]
} as TopicsContextType)

export function useTopics() {
  return useContext(TopicsContext)
}

export type TopicSort = 'shouts' | 'followers' | 'authors' | 'title'

/**
 * Загружает топики с обновлением статистики из сообщества
 * @returns Промис с массивом топиков с обновленной статистикой
 */
async function loadTopicsWithStats(): Promise<Topic[]> {
  try {
    // Загрузка основных топиков через старое API
    const topicsLoader = loadTopics()
    const mainTopics = (await topicsLoader()) || []

    // Загрузка топиков с актуальной статистикой из сообщества
    const options: QueryGet_Topics_By_CommunityArgs = {
      community_id: 1,
      limit: 100, // загружаем максимальное количество для обновления статистики
      offset: 0
    }

    const topicsWithStatsLoader = loadTopicsByCommunity(options)
    const topicsWithStats = (await topicsWithStatsLoader()) || []

    // Создаем мапу топиков со статистикой по слагам
    const statsMap: Record<string, Topic> = {}
    topicsWithStats.forEach((topic) => {
      if (topic?.slug) {
        statsMap[topic.slug] = topic
      }
    })

    // Обновляем статистику в основных топиках
    const updatedTopics = mainTopics.map((topic) => {
      if (topic?.slug && statsMap[topic.slug]) {
        return {
          ...topic,
          stat: statsMap[topic.slug].stat
        }
      }
      return topic
    })

    return updatedTopics
  } catch (error) {
    console.error('Failed to load topics with stats:', error)
    // Возвращаем пустой массив в случае ошибки
    return []
  }
}

// Простая реализация провайдера без IndexedDB
export const TopicsProvider: Component<{ children: JSX.Element }> = (props) => {
  const [state, setState] = createStore({
    entities: {} as Record<string, Topic>,
    sorted: [] as Topic[],
    sortBy: 'shouts' as TopicSort,
    random: undefined as Topic | undefined,
    loading: true,
    error: undefined as Error | undefined,
    offset: 0,
    limit: TOPICS_PER_PAGE,
    hasMore: true,
    byAuthors: [] as Topic[],
    byShouts: [] as Topic[]
  })

  const [topics, { refetch }] = createResource<Topic[], { sortBy: TopicSort }>(
    () => ({ sortBy: state.sortBy }),
    async ({ sortBy }) => {
      try {
        setState('loading', true)
        
        // Простая загрузка данных без кеширования
        const result = await loadTopicsWithStats()
        
        // Применяем сортировку к результату
        return result.sort(byTopicStatDesc(sortBy))
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
    () => ({ offset: state.offset, limit: state.limit }),
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

        setState('hasMore', newData?.length >= limit)
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

  createEffect(() => {
    const newTopics = topics()
    if (!newTopics?.length) return

    setState((prev: any) => {
      // Создаем новый объект entities один раз
      const newEntities = { ...prev.entities }

      // Заполняем его без spread
      newTopics.forEach((t: Topic) => {
        if (t?.slug) newEntities[t.slug] = t
      })

      // Получаем все топики с правильной типизацией
      const allTopics = Object.values(newEntities) as Topic[]

      // Топики с авторами
      const topicsByAuthors = allTopics
        .filter((topic: Topic) => topic.stat?.authors && topic.stat.authors > 0)
        .sort(byTopicStatDesc('authors'))

      // Топики с публикациями
      const topicsByShouts = allTopics
        .filter((topic: Topic) => topic.stat?.shouts && topic.stat.shouts > 0)
        .sort(byTopicStatDesc('shouts'))

      // Применяем сортировку к текущему выбранному типу
      const sorted = allTopics.sort(byTopicStatDesc(prev.sortBy))

      // Восстанавливаем random
      const random = prev.random || sorted[0]

      return {
        ...prev,
        entities: newEntities,
        sorted,
        byAuthors: topicsByAuthors,
        byShouts: topicsByShouts,
        random,
        loading: false
      }
    })
  })

  // Отдельный эффект для обработки топиков из сообщества для пагинации
  createEffect(() => {
    const newTopics = communityTopics()
    if (!newTopics?.length) return

    setState((prev: any) => {
      // Создаем новый объект entities
      const newEntities = { ...prev.entities }

      // Добавляем новые топики или обновляем существующие
      newTopics.forEach((t: Topic) => {
        if (t?.slug) newEntities[t.slug] = t
      })

      // Получаем все топики с правильной типизацией
      const allTopics = Object.values(newEntities) as Topic[]

      // Обновляем отдельные списки по типам сортировки в зависимости от текущей сортировки
      let byAuthors = [...prev.byAuthors]
      let byShouts = [...prev.byShouts]

      // Обновляем только тот список, который соответствует текущей сортировке
      if (prev.sortBy === 'authors') {
        const newAuthors = newTopics.filter((topic: Topic) => topic.stat?.authors && topic.stat.authors > 0)
        byAuthors = [...byAuthors, ...newAuthors].sort(byTopicStatDesc('authors'))
      } else if (prev.sortBy === 'shouts') {
        const newShouts = newTopics.filter((topic: Topic) => topic.stat?.shouts && topic.stat.shouts > 0)
        byShouts = [...byShouts, ...newShouts].sort(byTopicStatDesc('shouts'))
      }

      // Применяем сортировку к полному списку топиков
      const sorted = allTopics.sort(byTopicStatDesc(prev.sortBy))

      return {
        ...prev,
        entities: newEntities,
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
    setTopicsSort: (sortBy) => {
      setState('sortBy', sortBy as TopicSort)
      setState('offset', 0)
      refetch()
    },
    addTopics: (newTopics) =>
      setState((prev) => {
        // Создаем новый объект entities один раз
        const newEntities = { ...prev.entities }

        // Заполняем его без spread
        newTopics.forEach((t) => {
          if (t?.slug) newEntities[t.slug] = t
        })

        return {
          ...prev,
          entities: newEntities
        }
      }),
    loadTopics: async () => {
      // Принудительно обновляем данные
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
