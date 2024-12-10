import { RouteDefinition, RouteSectionProps } from '@solidjs/router'
import { createResource } from 'solid-js'
import { NoHydration } from 'solid-js/web'
import { InboxView } from '~/components/Views/InboxView'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useAuthors } from '~/context/authors'
import { useLocalize } from '~/context/localize'
import { loadAuthorsAll } from '~/graphql/api/public'
import { Author } from '~/graphql/schema/core.gen'

export const route = {
  load: async () => {
    const authorsAllFetcher = loadAuthorsAll()
    return {
      authors: await authorsAllFetcher()
    }
  }
} satisfies RouteDefinition

export const InboxPage = (props: RouteSectionProps<{ authors: Author[] }>) => {
  const { t } = useLocalize()
  const { authorsSorted } = useAuthors()

  const [authors] = createResource(
    async () => {
      if (props.data.authors) {
        return props.data.authors
      }
      if (authorsSorted()) {
        return authorsSorted()
      }
      const authorsAllFetcher = loadAuthorsAll()
      return await authorsAllFetcher()
    },
    {
      initialValue: props.data.authors
    }
  )

  return (
    <PageLayout hideFooter={true} title={t('Inbox')}>
      <NoHydration>
        <InboxView authors={authors() || []} />
      </NoHydration>
    </PageLayout>
  )
}
