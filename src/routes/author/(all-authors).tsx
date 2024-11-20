import { RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { Show, createEffect, createSignal, on } from 'solid-js'
import { AllAuthorsView } from '~/components/Views/AllAuthorsView'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useLocalize } from '~/context/localize'
import { loadAuthors, loadAuthorsAll } from '~/graphql/api/public'
import { Author, AuthorsBy } from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'

const AUTHORS_PER_PAGE = 20

// Function to fetch authors with a specific stat (followers or shouts)
const fetchAuthorsWithStat = async (offset: number, order?: string, limit = AUTHORS_PER_PAGE) => {
  const by: AuthorsBy = { order }
  const authorsFetcher = loadAuthors({ by, offset, limit })
  const result = await authorsFetcher()
  return result
}

// Route definition to load initial data
export const route = {
  load: async ({ location: { query } }) => {
    const by = query.by
    const isAll = by === 'name'
    const authorsAllFetcher = loadAuthorsAll()
    const data = {
      authors: isAll && (await authorsAllFetcher()),
      authorsByFollowers: (await fetchAuthorsWithStat(0, 'followers', 20)) || [],
      authorsByShouts: (await fetchAuthorsWithStat(0, 'shouts', 20)) || []
    }
    return data as AllAuthorsData
  }
} satisfies RouteDefinition

type AllAuthorsData = { authors: Author[]; authorsByFollowers: Author[]; authorsByShouts: Author[] }

export default function AllAuthorsPage(props: RouteSectionProps<AllAuthorsData>) {
  const { t } = useLocalize()
  const [authors, setAuthors] = createSignal<Author[]>([])
  const [authorsByFollowers, setAuthorsByFollowers] = createSignal<Author[]>([])
  const [authorsByShouts, setAuthorsByShouts] = createSignal<Author[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [loadMoreVisible, setLoadMoreVisible] = createSignal(false)

  // Function to load more authors
  const loadMore = async (offset: number) => {
    saveScrollPosition()
    const limit = AUTHORS_PER_PAGE
    try {
      const result = {
        authorsByFollowers: (await fetchAuthorsWithStat(offset, 'followers', limit)) || [],
        authorsByShouts: (await fetchAuthorsWithStat(offset, 'shouts', limit)) || []
      }
      setLoadMoreVisible(
        Boolean(result?.authorsByFollowers.length) && Boolean(result?.authorsByShouts.length)
      )

      if (
        offset !== 0 &&
        result.authorsByFollowers &&
        Array.isArray(result.authorsByFollowers) &&
        result.authorsByShouts &&
        Array.isArray(result.authorsByShouts)
      ) {
        setAuthorsByFollowers((prev) => [...prev, ...result.authorsByFollowers])
        setAuthorsByShouts((prev) => [...prev, ...result.authorsByShouts])
      }
      console.log('AllAuthorsPage loadMore:', result)
      restoreScrollPosition()
      return result.authorsByFollowers as LoadMoreItems
    } catch (error) {
      console.log('Error loading more shouts', error)
      return []
    }
  }

  // Effect to fetch authors data when the layout changes
  createEffect(
    on(
      () => props.location.query.by,
      async (layout) => {
        setIsLoading(true)
        const isAll = layout === 'name'
        const authorsAllFetcher = loadAuthorsAll()
        const result = {
          authors: isAll && (await authorsAllFetcher()),
          authorsByFollowers: (await fetchAuthorsWithStat(0, 'followers', 20)) || [],
          authorsByShouts: (await fetchAuthorsWithStat(0, 'shouts', 20)) || []
        }
        console.log('AllAuthorsPage data:', result)
        setAuthors(result.authors || [])
        setAuthorsByFollowers(result.authorsByFollowers || [])
        setAuthorsByShouts(result.authorsByShouts || [])
        setIsLoading(false)
      }
    )
  )

  return (
    <PageLayout
      withPadding={true}
      title={`${t('Discours')} :: ${t('All authors')}`}
      desc="List of authors of the open editorial community"
    >
      <Show when={!isLoading()} fallback={<Loading />}>
        <Show when={authors().length > 0}>
          <AllAuthorsView
            isLoaded={!isLoading()}
            authors={authors() || []}
            authorsByFollowers={authorsByFollowers() || []}
            authorsByShouts={authorsByShouts() || []}
          />
        </Show>
        <Show when={authors().length === 0}>
          <LoadMoreWrapper loadFunction={loadMore} pageSize={AUTHORS_PER_PAGE} hidden={!loadMoreVisible()}>
            <AllAuthorsView
              isLoaded={!isLoading()}
              authors={authors() || []}
              authorsByFollowers={authorsByFollowers() || []}
              authorsByShouts={authorsByShouts() || []}
            />
          </LoadMoreWrapper>
        </Show>
      </Show>
    </PageLayout>
  )
}
