import { Accessor, createContext, createEffect, createMemo, createSignal, JSX, on, useContext } from 'solid-js'
import { getAuthor, loadAuthors, loadAuthorsAll, loadAuthorsSearch } from '~/graphql/api/public'
import { Author, Maybe, QueryGet_AuthorArgs, QueryLoad_Authors_ByArgs, Shout, Topic } from '~/graphql/generated/graphql'
import { FilterFunction, SortFunction } from '~/types/nav'
import { byStat } from '~/utils/sort'
import { useFeed } from './feed'

const TOP_AUTHORS_COUNT = 5

// Define the structure for authors search state, similar to FeedState in feed.tsx
interface AuthorsSearchState {
  authors: Author[]
  isLoading: boolean
  hasMore: boolean
  isEmpty?: boolean
  error?: Error
}

const emptySearch: AuthorsSearchState = {
  authors: [],
  isLoading: false,
  hasMore: false,
  isEmpty: true
}

// Универсальная функция фильтрации и сортировки
function filterAndSort<Author>(
  items: Author[],
  sortFunction: SortFunction<Author>,
  filters: FilterFunction<Author>[] = []
): Author[] {
  return items.filter((a: Author) => filters.every((filter) => filter(a))).sort(sortFunction)
}

type AuthorsContextType = {
  authorsEntities: Accessor<Record<string, Author>>
  authorsSorted: Accessor<Author[]>
  addAuthors: (authors: Author[]) => void
  addAuthor: (author: Author) => void
  loadAuthor: (args: QueryGet_AuthorArgs) => Promise<Author | undefined>
  loadAuthors: (args: QueryLoad_Authors_ByArgs) => Promise<Author[] | undefined>
  topAuthors: Accessor<Author[]>
  authorsByTopic: Accessor<{ [topicSlug: string]: Author[] }>
  setAuthorsSort: (stat: string) => void
  loadAllAuthors: () => Promise<Author[]>
  // search-related properties
  searchAuthorsState: Accessor<AuthorsSearchState>
  loadAuthorsSearchResults: (text: string, limit?: number, offset?: number) => Promise<void>
  resetAuthorsSearch: () => void
  // ✅ Простые геттеры для AllAuthorsView - используем существующие данные
  allAuthors: Accessor<Author[]> // Все авторы без статистики (из entities)
}

const AuthorsContext = createContext<AuthorsContextType>({} as AuthorsContextType)

export const useAuthors = () => useContext(AuthorsContext)

export const AuthorsProvider = (props: { children: JSX.Element }) => {
  const [authorsEntities, setAuthors] = createSignal<Record<string, Author>>({})
  const [authorsSorted, setAuthorsSorted] = createSignal<Author[]>([])
  const [sortBy, setSortBy] = createSignal<SortFunction<Author>>()
  const { feedByAuthor } = useFeed()

  // state for authors search
  const [searchAuthorsState, setSearchAuthorsState] = createSignal<AuthorsSearchState>(emptySearch)
  const setAuthorsSort = (stat: string) => setSortBy(() => byStat(stat) as SortFunction<Author>)

  // Эффект для отслеживания изменений сигнала sortBy и обновления authorsSorted
  createEffect(
    on(
      [sortBy, authorsEntities],
      ([sortfn, authorsdict]) => {
        if (sortfn) {
          setAuthorsSorted([...filterAndSort(Object.values(authorsdict), sortfn)])
        }
      },
      { defer: true }
    )
  )

  const addAuthors = (newAuthors: Author[]) => {
    setAuthors((prevAuthors) => {
      const updatedAuthors = { ...prevAuthors }
      Array.isArray(newAuthors) &&
        newAuthors.forEach((author) => {
          // ✅ ОБЪЕДИНЯЕМ данные: сохраняем существующие поля + добавляем новые
          const existingAuthor = updatedAuthors[author.slug]
          if (existingAuthor) {
            // Объединяем существующего автора с новыми данными
            updatedAuthors[author.slug] = {
              ...existingAuthor,
              // ✅ Особое внимание к статистике - объединяем stat если есть
              stat: author.stat
                ? {
                    ...existingAuthor.stat,
                    ...author.stat
                  }
                : existingAuthor.stat
            }
          } else {
            // Новый автор - просто добавляем
            updatedAuthors[author.slug] = author
          }
        })
      return updatedAuthors
    })
  }

  const addAuthor = (newAuthor: Author) => {
    setAuthors((prevAuthors) => {
      const updatedAuthors = { ...prevAuthors }
      // ✅ ОБЪЕДИНЯЕМ данные и для одного автора
      const existingAuthor = updatedAuthors[newAuthor.slug]
      if (existingAuthor) {
        updatedAuthors[newAuthor.slug] = {
          ...existingAuthor,
          ...newAuthor,
          stat: newAuthor.stat
            ? {
                ...existingAuthor.stat,
                ...newAuthor.stat
              }
            : existingAuthor.stat
        }
      } else {
        updatedAuthors[newAuthor.slug] = newAuthor
      }
      return updatedAuthors
    })
  }

  const loadAuthor = async (opts: QueryGet_AuthorArgs): Promise<Author | undefined> => {
    try {
      // Проверяем нужно ли декодировать slug
      console.log(`[AuthorsProvider] Loading author with slug: "${opts.slug}"`)

      let queryOptions = opts
      if (opts.slug) {
        const decodedSlug = decodeURIComponent(opts.slug)
        if (decodedSlug !== opts.slug) {
          queryOptions = { ...opts, slug: decodedSlug }
        }
      }

      const fetcher = await getAuthor(queryOptions)
      const author = await fetcher()
      if (author) {
        addAuthor(author as Author)
      }
      return author
    } catch (error) {
      console.error('[context.authors] Error loading author:', error, 'for opts:', opts)
      throw error
    }
  }

  const loadAuthorsPaginated = async (args: QueryLoad_Authors_ByArgs): Promise<Author[] | undefined> => {
    try {
      const fetcher = await loadAuthors(args)
      const data = await fetcher()
      if (data) addAuthors(data as Author[])
      return data
    } catch (error) {
      console.error('Error loading authors:', error)
      throw error
    }
  }

  // method to load authors search results
  const loadAuthorsSearchResults = async (text: string, limit = 20, offset = 0) => {
    if (!text || text.trim().length < 3) {
      setSearchAuthorsState({
        authors: [],
        isLoading: false,
        hasMore: false,
        isEmpty: true
      })
      return
    }

    // Set loading state
    setSearchAuthorsState((prev) => ({ ...prev, isLoading: true }))

    try {
      console.debug('[AuthorsProvider] Searching authors:', { text, limit, offset })
      const result = await loadAuthorsSearch({ text, limit, offset })()
      console.debug('[AuthorsProvider] Search results:', {
        count: result?.length,
        hasMore: (result || []).length >= limit
      })

      // If this is a new search (offset is 0), replace the entire list
      // Otherwise, append the new results to the existing list
      setSearchAuthorsState((prev) => ({
        authors: offset ? [...prev.authors, ...(result || [])] : result || [],
        isLoading: false,
        hasMore: (result || []).length >= limit,
        isEmpty: !result?.length && offset === 0
      }))

      // Add the results to our entity collection
      if (result?.length) {
        addAuthors(result)
      }
    } catch (error) {
      console.error('[AuthorsProvider] Search API error:', error)
      setSearchAuthorsState((prev) => ({
        ...prev,
        isLoading: false,
        error: error as Error,
        isEmpty: offset === 0 ? true : prev.isEmpty
      }))
    }
  }

  // Method to reset search state
  const resetAuthorsSearch = () => {
    setSearchAuthorsState(emptySearch)
  }

  const topAuthors = createMemo(() => {
    const articlesByAuthorMap = feedByAuthor?.() || {}

    // Получаем всех авторов
    const authors = Object.keys(articlesByAuthorMap).map((authorSlug) => ({
      slug: authorSlug,
      rating: articlesByAuthorMap[authorSlug].reduce(
        (acc: number, article: Shout) => acc + (article.stat?.rating || 0),
        0
      )
    }))

    // Определяем функцию сортировки по рейтингу
    const sortByRating: SortFunction<{ slug: string; rating: number }> = (a, b) => b.rating - a.rating

    // Фильтруем и сортируем авторов
    const sortedTopAuthors = filterAndSort(authors, sortByRating)
      .slice(0, TOP_AUTHORS_COUNT)
      .map((author) => authorsEntities()[author.slug])
      .filter(Boolean)

    return sortedTopAuthors
  })

  const authorsByTopic = createMemo(() => {
    const articlesByAuthorMap = feedByAuthor?.() || {}
    const result: { [topicSlug: string]: Author[] } = {}

    Object.values(articlesByAuthorMap).forEach((articles) => {
      articles.forEach((article) => {
        const { authors, topics } = article
        if (topics) {
          topics.forEach((topic: Maybe<Topic>, _index: number, _array: Maybe<Topic>[]) => {
            if (topic) {
              if (!result[topic.slug]) {
                result[topic.slug] = []
              }
              if (authors) {
                authors.forEach((author) => {
                  if (!result[topic.slug].some((a) => a.slug === author?.slug)) {
                    result[topic.slug].push(author as Author)
                  }
                })
              }
            }
          })
        }
      })
    })

    return result
  })

  const loadAllAuthors = async () => {
    const fetcher = loadAuthorsAll()
    const data = await fetcher()
    addAuthors(data || [])
    return data || []
  }

  const contextValue: AuthorsContextType = {
    authorsEntities,
    authorsSorted,
    addAuthors,
    addAuthor,
    loadAuthor,
    loadAuthors: loadAuthorsPaginated, // with stat
    loadAllAuthors, // without stat
    topAuthors,
    authorsByTopic,
    setAuthorsSort,
    // New search methods
    searchAuthorsState,
    loadAuthorsSearchResults,
    resetAuthorsSearch,
    // ✅ Простые геттеры для AllAuthorsView
    allAuthors: () => Object.values(authorsEntities()) // Все авторы из entities
  }

  return <AuthorsContext.Provider value={contextValue}>{props.children}</AuthorsContext.Provider>
}
