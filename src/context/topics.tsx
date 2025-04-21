import { deleteDB, openDB } from 'idb'
import { Accessor, Component, JSX, createContext, createEffect, createResource, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import { isServer } from 'solid-js/web'
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

// Константы для кеширования
const DB_NAME = 'discoursio-store'
const OLD_DB_NAME = 'discoursio-storage' // Имя старой БД для удаления
const DB_VERSION = 1
const STORE_NAME = 'topics'
const CACHE_LIFETIME = 24 * 60 * 60 * 1000 // 24 часа
const FORCE_UPDATE_KEY = 'topics_force_update'

/**
 * Инициализирует базу данных, удаляя старые версии при необходимости
 */
const setupIndexedDB = async () => {
  if (isServer) return null

  try {
    // Попытка удалить старую базу данных, если она существует
    try {
      await deleteDB(OLD_DB_NAME)
      console.log('Старая база данных удалена:', OLD_DB_NAME)
    } catch (_err) {
      // Игнорируем ошибки при удалении
    }

    // Проверяем необходимость принудительного обновления
    const needsForceUpdate = !localStorage.getItem(FORCE_UPDATE_KEY)
    if (needsForceUpdate) {
      // Удаляем текущую базу и создаем новую для очистки всех старых данных
      try {
        await deleteDB(DB_NAME)
        console.log('База данных очищена для принудительного обновления')
        localStorage.setItem(FORCE_UPDATE_KEY, Date.now().toString())
      } catch (err) {
        console.error('Не удалось очистить базу данных:', err)
      }
    }

    return await openDB<{ topics: Topic[]; timestamp: number }>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
    })
  } catch (e) {
    console.error('Failed to open IndexedDB:', e)
    return null
  }
}

export type TopicSort = 'shouts' | 'followers' | 'authors' | 'title'

/**
 * Загружает топики из кеша
 * @returns Массив топиков и флаг необходимости обновления
 */
async function loadFromCache(): Promise<{ topics: Topic[] | null; needsUpdate: boolean }> {
  if (isServer) return { topics: null, needsUpdate: true }

  const db = await setupIndexedDB()
  if (!db) return { topics: null, needsUpdate: true }

  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const [cached, timestamp] = await Promise.all([
      store.get('data') as Promise<Topic[] | undefined>,
      store.get('timestamp') as Promise<number | undefined>
    ])

    // Проверяем время жизни кеша и валидность данных
    const isCacheExpired = !timestamp || Date.now() - timestamp > CACHE_LIFETIME
    const isValidCache = cached && Array.isArray(cached) && cached.length > 0

    if (!isValidCache) {
      console.log('Кеш топиков невалиден, требуется обновление')
      return { topics: null, needsUpdate: true }
    }

    // Возвращаем кеш даже если он устарел (stale-while-revalidate)
    return {
      topics: isValidCache ? cached : null,
      needsUpdate: isCacheExpired || !isValidCache
    }
  } catch (error) {
    console.error('Ошибка при чтении кеша:', error)
    return { topics: null, needsUpdate: true }
  }
}

/**
 * Сохраняет топики в кеш
 * @param topics Массив топиков для сохранения
 */
async function saveToCache(topics: Topic[]): Promise<void> {
  if (isServer) return

  const db = await setupIndexedDB()
  if (!db) return

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await Promise.all([
      tx.objectStore(STORE_NAME).put(topics, 'data'),
      tx.objectStore(STORE_NAME).put(Date.now(), 'timestamp')
    ])
    console.log(`Сохранено ${topics.length} топиков в кеше`)
  } catch (error) {
    console.error('Ошибка при сохранении кеша:', error)
  }
}

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

/**
 * Очищает кеш топиков
 */
async function clearCache(): Promise<void> {
  if (isServer) return

  try {
    const db = await setupIndexedDB()
    if (!db) return

    const tx = db.transaction(STORE_NAME, 'readwrite')
    await tx.objectStore(STORE_NAME).clear()
    console.log('Кеш топиков очищен')
  } catch (error) {
    console.error('Ошибка при очистке кеша:', error)
  }
}

// Явно указываем возвращаемый тип
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

        // Загружаем данные из кеша и определяем нужно ли обновление
        const { topics: cached, needsUpdate } = await loadFromCache()

        let result: Topic[] = []

        // Используем stale-while-revalidate стратегию
        if (cached?.length) {
          // Если есть кеш, используем его немедленно
          result = cached

          // Если требуется обновление, делаем его асинхронно
          if (needsUpdate) {
            loadTopicsWithStats()
              .then((newData) => {
                if (newData?.length) {
                  saveToCache(newData)

                  // Обновляем состояние без перерендера
                  setState((prev) => {
                    const newEntities = { ...prev.entities }
                    newData.forEach((t) => {
                      if (t?.slug) newEntities[t.slug] = t
                    })

                    // Обновляем отдельные списки по типам сортировки
                    const allTopics = Object.values(newEntities)

                    // Топики с авторами
                    const topicsByAuthors = allTopics
                      .filter((topic) => topic.stat?.authors && topic.stat.authors > 0)
                      .sort(byTopicStatDesc('authors'))

                    // Топики с публикациями
                    const topicsByShouts = allTopics
                      .filter((topic) => topic.stat?.shouts && topic.stat.shouts > 0)
                      .sort(byTopicStatDesc('shouts'))

                    // Все топики, отсортированные по заголовку
                    const topicsByTitle = [...allTopics].sort((a, b) =>
                      (a.title || '').localeCompare(b.title || '')
                    )

                    // Применяем сортировку к текущему выбранному типу
                    const sorted = allTopics.sort(byTopicStatDesc(prev.sortBy))

                    return {
                      ...prev,
                      entities: newEntities,
                      sorted,
                      byAuthors: topicsByAuthors,
                      byShouts: topicsByShouts,
                      byTitle: topicsByTitle
                    }
                  })
                }
              })
              .catch((e) => {
                console.error('Background update failed:', e)
              })
          }
        } else {
          // Если кеша нет, загружаем новые данные блокирующе
          const newData = await loadTopicsWithStats()

          if (newData?.length) {
            await saveToCache(newData)
            result = newData
          }
        }

        // Применяем сортировку к результату
        return result.sort(byTopicStatDesc(sortBy))
      } catch (error) {
        console.error('Failed to load topics:', error)
        setState('error', error as Error)
        // В случае ошибки возвращаем кеш если есть
        const { topics: cached } = await loadFromCache()
        return cached || []
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

    setState((prev) => {
      // Создаем новый объект entities один раз
      const newEntities = { ...prev.entities }

      // Заполняем его без spread
      newTopics.forEach((t) => {
        if (t?.slug) newEntities[t.slug] = t
      })

      // Получаем все топики
      const allTopics = Object.values(newEntities)

      // Обновляем отдельные списки по типам сортировки
      // Топики с авторами
      const topicsByAuthors = allTopics
        .filter((topic) => topic.stat?.authors && topic.stat.authors > 0)
        .sort(byTopicStatDesc('authors'))

      // Топики с публикациями
      const topicsByShouts = allTopics
        .filter((topic) => topic.stat?.shouts && topic.stat.shouts > 0)
        .sort(byTopicStatDesc('shouts'))

      // Все топики, отсортированные по заголовку
      const topicsByTitle = [...allTopics].sort((a, b) => (a.title || '').localeCompare(b.title || ''))

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
        byTitle: topicsByTitle,
        random,
        loading: false
      }
    })
  })

  // Отдельный эффект для обработки топиков из сообщества для пагинации
  createEffect(() => {
    const newTopics = communityTopics()
    if (!newTopics?.length) return

    setState((prev) => {
      // Создаем новый объект entities
      const newEntities = { ...prev.entities }

      // Добавляем новые топики или обновляем существующие
      newTopics.forEach((t) => {
        if (t?.slug) newEntities[t.slug] = t
      })

      // Получаем все топики
      const allTopics = Object.values(newEntities)

      // Обновляем отдельные списки по типам сортировки в зависимости от текущей сортировки
      let byAuthors = [...prev.byAuthors]
      let byShouts = [...prev.byShouts]

      // Обновляем только тот список, который соответствует текущей сортировке
      if (prev.sortBy === 'authors') {
        const newAuthors = newTopics.filter((topic) => topic.stat?.authors && topic.stat.authors > 0)
        byAuthors = [...byAuthors, ...newAuthors].sort(byTopicStatDesc('authors'))
      } else if (prev.sortBy === 'shouts') {
        const newShouts = newTopics.filter((topic) => topic.stat?.shouts && topic.stat.shouts > 0)
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
      // Очищаем кеш перед принудительным обновлением
      await clearCache()

      // Принудительно обновляем данные (всегда)
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
