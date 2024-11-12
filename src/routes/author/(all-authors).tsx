import { RouteDefinition, RouteLoadFuncArgs, type RouteSectionProps, createAsync } from '@solidjs/router'
import { Suspense, createEffect, on } from 'solid-js'
import { AUTHORS_PER_PAGE, AllAuthorsView } from '~/components/Views/AllAuthorsView'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useAuthors } from '~/context/authors'
import { useLocalize } from '~/context/localize'
import { loadAuthors, loadAuthorsAll } from '~/graphql/api/public'
import { Author, AuthorsBy } from '~/graphql/schema/core.gen'

const fetchAuthorsWithStat = async (offset = 0, order?: string) => {
  const by: AuthorsBy = { order }
  const authorsFetcher = loadAuthors({ by, offset, limit: AUTHORS_PER_PAGE })
  return await authorsFetcher()
}

export const route = {
  load: async ({ location: { query } }: RouteLoadFuncArgs) => {
    const by = query.by
    const isAll = !by || by === 'name'
    const authorsAllFetcher = loadAuthorsAll()
    return {
      authors: isAll && (await authorsAllFetcher()),
      authorsByFollowers: await fetchAuthorsWithStat(10, 'followers'),
      authorsByShouts: await fetchAuthorsWithStat(10, 'shouts')
    } as AllAuthorsData
  }
} satisfies RouteDefinition

type AllAuthorsData = { authors: Author[]; authorsByFollowers: Author[]; authorsByShouts: Author[] }

// addAuthors to context

export default function AllAuthorsPage(props: RouteSectionProps<AllAuthorsData>) {
  const { t } = useLocalize()
  const { addAuthors, authorsSorted } = useAuthors()

  // async load data: from ssr or fetch
  const data = createAsync<AllAuthorsData>(async () => {
    if (props.data) return props.data
    const authorsAllFetcher = loadAuthorsAll()
    return {
      authors: authorsSorted() || (await authorsAllFetcher()),
      authorsByFollowers: await fetchAuthorsWithStat(10, 'followers'),
      authorsByShouts: await fetchAuthorsWithStat(10, 'shouts')
    } as AllAuthorsData
  })

  // update context when data is loaded
  createEffect(
    on(
      [data, () => addAuthors],
      ([data, aa]) => {
        if (data && aa) {
          aa(data.authors as Author[])
          aa(data.authorsByFollowers as Author[])
          aa(data.authorsByShouts as Author[])
          // console.debug('[routes.author] added all authors:', data.authors)
        }
      },
      { defer: true }
    )
  )

  return (
    <PageLayout
      withPadding={true}
      title={`${t('Discours')} :: ${t('All authors')}`}
      desc="List of authors of the open editorial community"
    >
      <Suspense fallback={<Loading />}>
        <AllAuthorsView
          isLoaded={Boolean(data()?.authors)}
          authors={data()?.authors || []}
          authorsByFollowers={data()?.authorsByFollowers}
          authorsByShouts={data()?.authorsByShouts}
        />
      </Suspense>
    </PageLayout>
  )
}
