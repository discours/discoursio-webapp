import {
  Accessor,
  JSX,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
  useContext
} from 'solid-js'
import { getAuthor, loadAuthors, loadAuthorsAll } from '~/graphql/api/public'
import {
  Author,
  Maybe,
  QueryGet_AuthorArgs,
  QueryLoad_Authors_ByArgs,
  Shout,
  Topic
} from '~/graphql/schema/core.gen'
import { FilterFunction, SortFunction } from '~/types/nav'
import { byStat } from '~/utils/sort'
import { useFeed } from './feed'

const TOP_AUTHORS_COUNT = 5

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
}

const AuthorsContext = createContext<AuthorsContextType>({} as AuthorsContextType)

export const useAuthors = () => useContext(AuthorsContext)

export const AuthorsProvider = (props: { children: JSX.Element }) => {
  const [authorsEntities, setAuthors] = createSignal<Record<string, Author>>({})
  const [authorsSorted, setAuthorsSorted] = createSignal<Author[]>([])
  const [sortBy, setSortBy] = createSignal<SortFunction<Author>>()
  const { feedByAuthor } = useFeed()
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
    // console.debug('[context.authors] storing new authors:', newAuthors)
    setAuthors((prevAuthors) => {
      const updatedAuthors = { ...prevAuthors }
      Array.isArray(newAuthors) &&
        newAuthors.forEach((author) => {
          updatedAuthors[author.slug] = author
        })
      return updatedAuthors
    })
  }

  const addAuthor = (newAuthor: Author) => {
    setAuthors((prevAuthors) => {
      const updatedAuthors = { ...prevAuthors }
      updatedAuthors[newAuthor.slug] = newAuthor
      return updatedAuthors
    })
  }

  const loadAuthor = async (opts: QueryGet_AuthorArgs): Promise<Author | undefined> => {
    try {
      console.debug('[context.authors] load author', opts)
      const fetcher = await getAuthor(opts)
      const author = await fetcher()
      if (author) addAuthor(author as Author)
      console.debug('[context.authors] loaded author', author)
      return author
    } catch (error) {
      console.error('[context.authors] Error loading author:', error)
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
    setAuthorsSort
  }

  return <AuthorsContext.Provider value={contextValue}>{props.children}</AuthorsContext.Provider>
}
