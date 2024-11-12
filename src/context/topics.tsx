import { createAsync } from '@solidjs/router'
import { IDBPDatabase, openDB } from 'idb'
import { Accessor, JSX, createContext, createEffect, createSignal, on, onMount, useContext } from 'solid-js'
import { loadTopics } from '~/graphql/api/public'
import { Topic } from '~/graphql/schema/core.gen'
import { getRandomItemsFromArray } from '~/utils/random'
import { byTopicStatDesc } from '../utils/sort'

type TopicsContextType = {
  topicEntities: Accessor<{ [topicSlug: string]: Topic }>
  sortedTopics: Accessor<Topic[]>
  randomTopic: Accessor<Topic | undefined>
  topTopics: Accessor<Topic[]>
  setTopicsSort: (sortBy: string) => void
  addTopics: (topics: Topic[]) => void
  loadTopics: () => Promise<Topic[]>
}

const TopicsContext = createContext<TopicsContextType>({
  topicEntities: () => ({}) as Record<string, Topic>,
  sortedTopics: () => [] as Topic[],
  topTopics: () => [] as Topic[],
  setTopicsSort: (_s: string) => undefined,
  addTopics: (_ttt: Topic[]) => undefined,
  loadTopics: async () => [] as Topic[],
  randomTopic: () => undefined
} as TopicsContextType)

export function useTopics() {
  return useContext(TopicsContext)
}

const DB_NAME = 'discourseAppDB'
const DB_VERSION = 1
const STORE_NAME = 'topics'
const CACHE_LIFETIME = 24 * 60 * 60 * 1000 // 24 часа

const setupIndexedDB = async () => {
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

export const fetchTopicsData = async () => {
  const topicsLoader = loadTopics()
  const ttt = await topicsLoader()
  return ttt || []
}

export type TopicSort = 'shouts' | 'followers' | 'authors' | 'title'

export const TopicsProvider = (props: { children: JSX.Element }) => {
  const [topicEntities, setTopicEntities] = createSignal<{ [topicSlug: string]: Topic }>({})
  const [sortedTopics, setSortedTopics] = createSignal<Topic[]>([])
  const [sortAllBy, setSortAllBy] = createSignal<TopicSort>('shouts')
  const [db, setDb] = createSignal<IDBPDatabase | null>(null)

  const getTopicsFromIndexedDB = async () => {
    const tx = db()?.transaction(STORE_NAME, 'readonly')
    const store = tx?.objectStore(STORE_NAME)
    const topics = await store?.get('data')
    const timestamp = await store?.get('timestamp')
    return { topics, timestamp }
  }

  onMount(async () => {
    const database = await setupIndexedDB()
    if (!database) return
    setDb(database as unknown as IDBPDatabase)

    try {
      const cached = (await database.get(STORE_NAME, 'data')) as Topic[] | undefined
      const timestamp = (await database.get(STORE_NAME, 'timestamp')) as number | undefined

      if (cached && timestamp && Date.now() - timestamp < CACHE_LIFETIME) {
        addTopics(cached)
      } else {
        const fresh = await loadAllTopics()
        if (fresh.length > 0) {
          await database.put(STORE_NAME, fresh, 'data')
          await database.put(STORE_NAME, Date.now(), 'timestamp')
          addTopics(fresh)
        }
      }
    } catch (e) {
      console.error('IndexedDB operation failed:', e)
      const fresh = await loadAllTopics()
      fresh.length > 0 && addTopics(fresh)
    }
  })

  const addTopics = (topics: Topic[]) => {
    const newTopicEntities = topics.reduce(
      (acc, topic) => {
        if (topic?.slug) acc[topic.slug] = topic
        return acc
      },
      {} as Record<string, Topic>
    )

    setTopicEntities((prev) => ({ ...prev, ...newTopicEntities }))
  }

  const topics = createAsync<Topic[]>(fetchTopicsData as () => Promise<Topic[]>)
  createEffect(
    on(
      () => topics() || [],
      (ttt: Topic[]) => ttt && addTopics(ttt),
      { defer: true }
    )
  )

  createEffect(() => {
    const topics = Object.values(topicEntities())
    // console.debug('[context.topics] effect trig', topics)
    switch (sortAllBy()) {
      case 'followers': {
        topics.sort(byTopicStatDesc('followers'))
        break
      }
      case 'shouts': {
        topics.sort(byTopicStatDesc('shouts'))
        break
      }
      case 'authors': {
        topics.sort(byTopicStatDesc('authors'))
        break
      }
      case 'title': {
        topics.sort((a, b) => (a?.title || '').localeCompare(b?.title || ''))
        break
      }
      default: {
        topics.sort(byTopicStatDesc('shouts'))
      }
    }
    setSortedTopics(topics as Topic[])
  })

  const [topTopics, setTopTopics] = createSignal<Topic[]>([])
  createEffect(
    on(topicEntities, (te: Record<string, Topic>) => {
      setTopTopics(Object.values(te).sort(byTopicStatDesc('shouts')))
    })
  )

  const loadAllTopics = async () => {
    const topicsLoader = loadTopics()
    const ttt = await topicsLoader()
    ttt && addTopics(ttt)
    return ttt || []
  }

  const [randomTopic, setRandomTopic] = createSignal<Topic>()
  createEffect(
    on(
      db,
      async (indexed) => {
        if (indexed) {
          const { topics: req, timestamp } = await getTopicsFromIndexedDB()
          const now = Date.now()
          const isCacheValid = now - timestamp < CACHE_LIFETIME

          const topics = isCacheValid ? req : await loadAllTopics()
          console.info(`[context.topics] got ${(topics as Topic[]).length || 0} topics from idb`)
          addTopics(topics as Topic[])
          setRandomTopic(getRandomItemsFromArray(topics as Topic[], 1)[0])
        }
      },
      { defer: true }
    )
  )

  const getCachedOrLoadTopics = async () => {
    const { topics: stored } = await getTopicsFromIndexedDB()
    if (stored) {
      setSortedTopics(stored)
      return stored
    }
    const loaded = await loadAllTopics()
    if (loaded) setSortedTopics(loaded)
    return loaded
  }

  // preload all topics
  onMount(getCachedOrLoadTopics)

  const value: TopicsContextType = {
    setTopicsSort: setSortAllBy,
    topicEntities,
    sortedTopics,
    randomTopic,
    topTopics,
    addTopics,
    loadTopics: loadAllTopics
  }

  return <TopicsContext.Provider value={value}>{props.children}</TopicsContext.Provider>
}
