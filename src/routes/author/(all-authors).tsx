import { RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { createEffect, createSignal, Show } from 'solid-js'
import { Loading } from '~/components/_shared/Loading'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { PageLayout } from '~/components/_shared/PageLayout'
import { AllAuthorsView } from '~/components/Views/AllAuthorsView'
import { useAuthors } from '~/context/authors'
import { useLocalize } from '~/context/localize'
import { loadAuthors, loadAuthorsAll } from '~/graphql/api/public'
import { Author, AuthorsBy } from '~/graphql/generated/graphql'

const AUTHORS_PER_PAGE = 20

// Function to fetch authors with a specific stat (followers or shouts)
const fetchAuthorsWithStat = async (offset: number, order?: string, limit = AUTHORS_PER_PAGE) => {
  const by: AuthorsBy = { order }
  const authorsFetcher = loadAuthors({ by, offset, limit })
  const result = await authorsFetcher()
  return result
}

// Route definition - загружаем только базовые данные для текущей вкладки
export const route = {
  load: async ({ location: { query } }) => {
    const layout = query.by || 'shouts'

    // Загружаем только нужные данные для текущей вкладки
    if (layout === 'name') {
      // Для алфавитного списка - все авторы без статистики
      return {
        authors: (await loadAuthorsAll()()) || [],
        currentLayout: layout
      }
    } else {
      // Для сортировки по статистике - авторы со статистикой
      const order = layout === 'followers' ? 'followers' : 'shouts'
      return {
        authorsByLayout: (await fetchAuthorsWithStat(0, order, AUTHORS_PER_PAGE)) || [],
        currentLayout: layout
      }
    }
  }
} satisfies RouteDefinition

type AllAuthorsData = {
  authors?: Author[]
  authorsByLayout?: Author[]
  currentLayout: string
}

export default function AllAuthorsPage(props: RouteSectionProps<AllAuthorsData>) {
  const { t } = useLocalize()
  const { addAuthors } = useAuthors()
  const [authors, setAuthors] = createSignal<Author[]>([])
  const [authorsByFollowers, setAuthorsByFollowers] = createSignal<Author[]>([])
  const [authorsByShouts, setAuthorsByShouts] = createSignal<Author[]>([])
  const [isLoading, setIsLoading] = createSignal(false)

  // Инициализируем данные из route.load
  createEffect(() => {
    if (props.data) {
      if (props.data.authors) {
        setAuthors(props.data.authors)
        addAuthors(props.data.authors)
      }
      if (props.data.authorsByLayout) {
        if (props.data.currentLayout === 'followers') {
          setAuthorsByFollowers(props.data.authorsByLayout)
        } else {
          setAuthorsByShouts(props.data.authorsByLayout)
        }
        addAuthors(props.data.authorsByLayout)
      }
    }
  })

  // Динамическая загрузка при смене вкладки
  createEffect(() => {
    const layout = props.location.query.by || 'shouts'

    const loadDataForLayout = async () => {
      setIsLoading(true)

      try {
        if (layout === 'name' && authors().length === 0) {
          const result = (await loadAuthorsAll()()) || []
          setAuthors(result)
          addAuthors(result)
        } else if (layout === 'followers' && authorsByFollowers().length === 0) {
          const result = (await fetchAuthorsWithStat(0, 'followers', AUTHORS_PER_PAGE)) || []
          setAuthorsByFollowers(result)
          addAuthors(result)
        } else if (layout === 'shouts' && authorsByShouts().length === 0) {
          const result = (await fetchAuthorsWithStat(0, 'shouts', AUTHORS_PER_PAGE)) || []
          setAuthorsByShouts(result)
          addAuthors(result)
        }
      } catch (error) {
        console.error('Error loading authors for layout:', layout, error)
      } finally {
        setIsLoading(false)
      }
    }

    void loadDataForLayout()
  })

  // Function to load more authors for followers layout
  const loadMoreFollowers = async (offset: number): Promise<LoadMoreItems> => {
    try {
      const result = await fetchAuthorsWithStat(offset, 'followers', AUTHORS_PER_PAGE)
      if (result && result.length > 0) {
        setAuthorsByFollowers((prev) => [...prev, ...result])
        addAuthors(result) // Добавляем в контекст
      }
      return result || []
    } catch (error) {
      console.error('Error loading more followers:', error)
      return []
    }
  }

  // Function to load more authors for shouts layout
  const loadMoreShouts = async (offset: number): Promise<LoadMoreItems> => {
    try {
      const result = await fetchAuthorsWithStat(offset, 'shouts', AUTHORS_PER_PAGE)
      if (result && result.length > 0) {
        setAuthorsByShouts((prev) => [...prev, ...result])
        addAuthors(result) // Добавляем в контекст
      }
      return result || []
    } catch (error) {
      console.error('Error loading more shouts:', error)
      return []
    }
  }

  const currentLayout = () => props.location.query.by || 'shouts'

  return (
    <PageLayout
      withPadding={true}
      title={`${t('Discours')} :: ${t('All authors')}`}
      desc="List of authors of the open editorial community"
    >
      <Show when={!isLoading()} fallback={<Loading />}>
        <Show when={currentLayout() === 'followers'}>
          <LoadMoreWrapper loadFunction={loadMoreFollowers} pageSize={AUTHORS_PER_PAGE} useScrollTrigger={false}>
            <AllAuthorsView
              isLoaded={!isLoading()}
              authors={authors()}
              authorsByFollowers={authorsByFollowers()}
              authorsByShouts={authorsByShouts()}
            />
          </LoadMoreWrapper>
        </Show>

        <Show when={currentLayout() === 'shouts'}>
          <LoadMoreWrapper loadFunction={loadMoreShouts} pageSize={AUTHORS_PER_PAGE} useScrollTrigger={false}>
            <AllAuthorsView
              isLoaded={!isLoading()}
              authors={authors()}
              authorsByFollowers={authorsByFollowers()}
              authorsByShouts={authorsByShouts()}
            />
          </LoadMoreWrapper>
        </Show>

        <Show when={currentLayout() === 'name'}>
          <AllAuthorsView
            isLoaded={!isLoading()}
            authors={authors()}
            authorsByFollowers={authorsByFollowers()}
            authorsByShouts={authorsByShouts()}
          />
        </Show>
      </Show>
    </PageLayout>
  )
}
