import { RouteDefinition, type RouteSectionProps } from '@solidjs/router'
import { Show, createEffect, createSignal, on } from 'solid-js'
import { AllAuthorsView } from '~/components/Views/AllAuthorsView'
import { LoadMoreItems } from '~/components/_shared/LoadMoreWrapper'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useLocalize } from '~/context/localize'
import { loadAuthors, loadAuthorsAll } from '~/graphql/api/public'
import { Author, AuthorsBy } from '~/graphql/schema/core.gen'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'

const AUTHORS_PER_PAGE = 20

// Function to fetch authors with a specific stat (followers or shouts)
const fetchAuthorsWithStat = async (offset = 0, order?: string, limit = AUTHORS_PER_PAGE) => {
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
  const [_loadMoreVisible, setLoadMoreVisible] = createSignal(false)
  const [isLoading, setIsLoading] = createSignal(false)

  // Function to load more authors
  const _loadMore = async () => {
    saveScrollPosition()
    const offset = authors()?.length || 0
    const layout = props.location.query.by || 'shouts'
    const isAll = layout === 'name'
    const newData = {
      authors: isAll && (await loadAuthorsAll()),
      authorsByFollowers: (await fetchAuthorsWithStat(offset, 'followers')) || [],
      authorsByShouts: (await fetchAuthorsWithStat(offset, 'shouts')) || []
    }
    if (newData.authors) setAuthors(newData.authors as unknown as Author[])
    if (newData.authorsByFollowers) setAuthorsByFollowers(newData.authorsByFollowers as Author[])
    if (newData.authorsByShouts) setAuthorsByShouts(newData.authorsByShouts as Author[])
    setLoadMoreVisible(
      Boolean(
        (Array.isArray(newData.authors) && newData.authors.length) ||
          newData.authorsByFollowers.length ||
          newData.authorsByShouts.length
      )
    )
    restoreScrollPosition()
    return newData as unknown as LoadMoreItems
  }

  // Effect to fetch authors data when the layout changes
  createEffect(
    on(
      () => props.location.query.by,
      async (layout) => {
        setIsLoading(true)
        const isAll = layout === 'name'
        const authorsAllFetcher = loadAuthorsAll()
        const newData = {
          authors: isAll && (await authorsAllFetcher()),
          authorsByFollowers: (await fetchAuthorsWithStat(0, 'followers', 20)) || [],
          authorsByShouts: (await fetchAuthorsWithStat(0, 'shouts', 20)) || []
        }
        setAuthors(newData.authors || [])
        setAuthorsByFollowers(newData.authorsByFollowers || [])
        setAuthorsByShouts(newData.authorsByShouts || [])
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
        {/* <LoadMoreWrapper loadFunction={loadMore} pageSize={AUTHORS_PER_PAGE} hidden={!loadMoreVisible()}> */}
        <AllAuthorsView
          isLoaded={!isLoading()}
          authors={authors() || []}
          authorsByFollowers={authorsByFollowers() || []}
          authorsByShouts={authorsByShouts() || []}
        />
        {/* </LoadMoreWrapper> */}
      </Show>
    </PageLayout>
  )
}
