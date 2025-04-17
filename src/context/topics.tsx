import { openDB } from 'idb'
import { Accessor, Component, JSX, createContext, createEffect, createResource, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'
import { isServer } from 'solid-js/web'
import { loadTopics } from '~/graphql/api/public'
import { Topic } from '~/graphql/schema/core.gen'
import { byTopicStatDesc } from '../utils/sort'

type TopicsContextType = {
  topicEntities: Accessor<{ [topicSlug: string]: Topic }>
  sortedTopics: Accessor<Topic[]>
  randomTopic: Accessor<Topic | undefined>
  topTopics: () => Topic[]
  setTopicsSort: (sortBy: string) => void
  addTopics: (topics: Topic[]) => void
  loadTopics: () => Promise<Topic[] | undefined>
  forceRefreshTopics: () => Promise<Topic[]>
}

const TopicsContext = createContext<TopicsContextType>({
  topicEntities: () => ({}) as Record<string, Topic>,
  sortedTopics: () => [] as Topic[],
  topTopics: () => [] as Topic[],
  setTopicsSort: (_s: string) => undefined,
  addTopics: (_ttt: Topic[]) => undefined,
  loadTopics: async () => [] as Topic[],
  randomTopic: () => undefined,
  forceRefreshTopics: async () => [] as Topic[]
} as TopicsContextType)

export function useTopics() {
  return useContext(TopicsContext)
}

const DB_NAME = 'discourseAppDB'
const DB_VERSION = 1
const STORE_NAME = 'topics'
const CACHE_LIFETIME = 24 * 60 * 60 * 1000 // 24 часа

const setupIndexedDB = async () => {
  if (isServer) return null

  try {
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

// Добавляем функции для работы с кешем
async function loadFromCache(): Promise<Topic[] | null> {
  if (isServer) return null

  const db = await setupIndexedDB()
  if (!db) return null

  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const [cached, timestamp] = await Promise.all([
    store.get('data') as Promise<Topic[] | undefined>,
    store.get('timestamp') as Promise<number | undefined>
  ])

  if (cached && timestamp && Date.now() - timestamp < CACHE_LIFETIME) {
    return cached
  }
  return null
}

async function saveToCache(topics: Topic[]): Promise<void> {
  if (isServer) return

  const db = await setupIndexedDB()
  if (!db) return

  const tx = db.transaction(STORE_NAME, 'readwrite')
  await Promise.all([
    tx.objectStore(STORE_NAME).put(topics, 'data'),
    tx.objectStore(STORE_NAME).put(Date.now(), 'timestamp')
  ])
}

// Добавляем константы для управления обновлениями
const TOPICS_UPDATE_INTERVAL = 24 * 60 * 60 * 1000 // 24 часа
const TOPICS_LAST_UPDATE_KEY = 'topics_last_update'

// Функция проверки необходимости обновления
function shouldUpdateTopics(): boolean {
  if (isServer) return true

  const lastUpdate = sessionStorage.getItem(TOPICS_LAST_UPDATE_KEY)
  if (!lastUpdate) return true

  const timeSinceLastUpdate = Date.now() - Number.parseInt(lastUpdate)
  return timeSinceLastUpdate > TOPICS_UPDATE_INTERVAL
}

// Функция обновления временной метки
function updateLastUpdateTime(): void {
  if (isServer) return

  sessionStorage.setItem(TOPICS_LAST_UPDATE_KEY, Date.now().toString())
}

// Добавляем тип для провайдера
// type TopicsProviderProps = {
//   children: JSX.Element
// }

// Явно указываем возвращаемый тип
export const TopicsProvider: Component<{ children: JSX.Element }> = (props) => {
  const [state, setState] = createStore({
    entities: {} as Record<string, Topic>,
    sorted: [] as Topic[],
    sortBy: 'shouts' as TopicSort,
    random: undefined as Topic | undefined,
    loading: true,
    error: undefined as Error | undefined
  })

  const [topics, { refetch }] = createResource<Topic[], { sortBy: TopicSort }>(
    () => ({ sortBy: state.sortBy }),
    async ({ sortBy }) => {
      try {
        // Сначала проверяем кеш
        const cached = await loadFromCache()

        // Проверяем необходимость обновления
        const needsUpdate = shouldUpdateTopics()

        let result: Topic[] = []

        if (cached?.length && !needsUpdate) {
          result = cached
        } else {
          // Загружаем новые данные только если нужно
          const topicsLoader = loadTopics()
          const newData = await topicsLoader()
          if (newData?.length) {
            await saveToCache(newData)
            updateLastUpdateTime()
            result = newData
          } else if (cached?.length) {
            result = cached
          }
        }

        // Применяем сортировку к результату
        return result.sort(byTopicStatDesc(sortBy))
      } catch (error) {
        console.error('Failed to load topics:', error)
        setState('error', error as Error)
        // В случае ошибки возвращаем кеш если есть
        const cached = await loadFromCache()
        return cached || []
      }
    }
  )

  // Добавляем функцию для принудительного обновления тем
  const forceRefreshTopics = async (): Promise<Topic[]> => {
    console.log('[Topics] Force refreshing topics from server')
    try {
      const topicsLoader = loadTopics()
      const newData = await topicsLoader()
      if (newData?.length) {
        await saveToCache(newData)
        updateLastUpdateTime()

        // Обновляем состояние
        setState((prev) => {
          // Создаем новый объект entities
          const newEntities = {} as Record<string, Topic>

          // Заполняем его
          newData.forEach((t) => {
            if (t?.slug) newEntities[t.slug] = t
          })

          // Сортируем
          const sorted = [...newData].sort(byTopicStatDesc(prev.sortBy))

          return {
            ...prev,
            entities: newEntities,
            sorted,
            random: sorted[0] || prev.random,
            loading: false
          }
        })

        return newData
      }
    } catch (error) {
      console.error('[Topics] Error during force refresh:', error)
    }

    // В случае ошибки возвращаем текущий список
    return state.sorted
  }

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

      // Восстанавливаем сортировку и random
      const sorted = Object.values(newEntities).sort(byTopicStatDesc(prev.sortBy))
      const random = prev.random || sorted[0]

      return {
        ...prev,
        entities: newEntities,
        sorted,
        random,
        loading: false
      }
    })
  })

  const value: TopicsContextType = {
    topicEntities: () => state.entities,
    sortedTopics: () => state.sorted,
    randomTopic: () => state.random,
    topTopics: () => state.sorted.slice(0, 10),
    setTopicsSort: (sortBy) => {
      setState('sortBy', sortBy as TopicSort)
      refetch()
    },
    addTopics: (newTopics) => {
      setState((prev) => {
        const newEntities = { ...prev.entities }
        newTopics.forEach((t) => {
          if (t?.slug) newEntities[t.slug] = t
        })
        return {
          ...prev,
          entities: newEntities,
          sorted: Object.values(newEntities).sort(byTopicStatDesc(prev.sortBy))
        }
      })
    },
    loadTopics: async () => {
      if (state.loading && !topics.loading) {
        refetch()
      }
      await topics.loading
      return state.sorted
    },
    forceRefreshTopics
  }

  return <TopicsContext.Provider value={value}>{props.children}</TopicsContext.Provider>
}
