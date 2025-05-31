import { type RouteDefinition } from '@solidjs/router'
import { Suspense } from 'solid-js'
import { AllTopicsView } from '~/components/Views/AllTopicsView'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useLocalize } from '~/context/localize'
import { loadTopics } from '~/graphql/api/public'

export const route = {
  load: () => loadTopics()
} satisfies RouteDefinition

export default () => {
  const { t } = useLocalize()
  return (
    <PageLayout
      withPadding={true}
      key="topics"
      title={`${t('Discours')} :: ${t('Themes and plots')}`}
      headerTitle={t('All topics')}
      desc="Thematic table of contents of the magazine. Here you can find all the topics that the community authors wrote about"
    >
      <Suspense fallback={<Loading />}>
        <AllTopicsView />
      </Suspense>
    </PageLayout>
  )
}
