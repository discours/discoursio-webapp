import { createAsync } from '@solidjs/router'
import { openDB } from 'idb'
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
const CACHE_LIFETIME = 24 * 60 * 60 * 1000 // один день в миллисекундах

const setupIndexedDB = async () => {
  if (window && !('indexedDB' in window)) {
    console.error("This browser doesn't support IndexedDB")
    return
  }

  try {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, _transaction) {
        console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`)
        if (db.objectStoreNames.contains(STORE_NAME)) {
          console.log(`Object store ${STORE_NAME} already exists`)
        } else {
          console.log(`Creating object store: ${STORE_NAME}`)
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
    })
    console.log('Database opened successfully:', db)
    return db
  } catch (e) {
    console.error('Failed to open IndexedDB:', e)
  }
}

const getTopicsFromIndexedDB = async (db: IDBDatabase) => {
  if (db) {
    return new Promise<{ topics: Topic[]; timestamp: number }>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const topics = request.result || []
        const timestamp =
          (tx.objectStore(STORE_NAME).get('timestamp') as IDBRequest<{ value: number }>).result?.value || 0
        resolve({ topics, timestamp })
      }

      request.onerror = () => {
        console.error('Error fetching topics from IndexedDB')
        reject()
      }
    })
  }
  return { topics: [], timestamp: 0 }
}

const saveTopicsToIndexedDB = async (db: IDBDatabase, topics: Topic[]) => {
  if (db) {
    const tx = (db as IDBDatabase).transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const timestamp = Date.now()

    topics?.forEach(async (topic: Topic) => {
      if (topic) await store.put(topic as Topic)
    })
    await store.put({ id: 'timestamp', value: timestamp })
    // @ts-ignore
    await tx.done
  }
}
export type TopicSort = 'shouts' | 'followers' | 'authors' | 'title'
export const fetchTopicsData = async () => {
  const topicsLoader = loadTopics()
  return await topicsLoader()
}
export const TopicsProvider = (props: { children: JSX.Element }) => {
  const [topicEntities, setTopicEntities] = createSignal<{ [topicSlug: string]: Topic }>({})
  const [sortedTopics, setSortedTopics] = createSignal<Topic[]>([])
  const [sortAllBy, setSortAllBy] = createSignal<TopicSort>('shouts')

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

  const addTopics = (...args: Topic[][]) => {
    const allTopics = args.flatMap((topics) => (topics || []).filter(Boolean))

    const newTopicEntities = allTopics.reduce(
      (acc, topic) => {
        acc[topic.slug] = topic
        return acc
      },
      {} as Record<string, Topic>
    )

    setTopicEntities((prevTopicEntities) => {
      const ttt = {
        ...prevTopicEntities,
        ...newTopicEntities
      }

      if (db()) saveTopicsToIndexedDB(db() as IDBDatabase, Object.values(ttt) as Topic[])
      return ttt
    })
  }
  const [db, setDb] = createSignal()
  createEffect(
    on(
      () => window?.indexedDB,
      async (_raw) => {
        const initialized = await setupIndexedDB()
        setDb(initialized)
      },
      { defer: true }
    )
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
          const { topics: req, timestamp } = await getTopicsFromIndexedDB(indexed as IDBDatabase)
          const now = Date.now()
          const isCacheValid = now - timestamp < CACHE_LIFETIME

          const topics = isCacheValid ? req : await loadAllTopics()
          console.info(`[context.topics] got ${(topics as Topic[]).length || 0} topics from idb`)
          addTopics(topics as Topic[])
          setRandomTopic(getRandomItemsFromArray(topics || [], 1).pop())
        }
      },
      { defer: true }
    )
  )

  const getCachedOrLoadTopics = async () => {
    const { topics: stored } = await getTopicsFromIndexedDB(db() as IDBDatabase)
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
