import { RouteSectionProps } from '@solidjs/router'

import { SuggestionsView } from '~/components/Views/SuggestionsView'
import { PageLayout } from '~/components/_shared/PageLayout'
import { createSignal, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { ExtendedDraft } from '~/context/drafts'
import { AuthGuard } from '~/components/AuthGuard'

export const SuggestBox = (props: RouteSectionProps) => {
  const { t } = useLocalize()
  const [isLoading, setIsLoading] = createSignal(true)
  const [previewData, setPreviewData] = createSignal<ExtendedDraft | null>(null)

  return (
    <PageLayout title={`${t('Discours')} :: ${t('Suggestions')}`} hideFooter={false}>
        <Show
        when={!isLoading() && previewData()}
        fallback={<div class="container py-5">{t('Loading suggestions...')}</div>}
        >   
      <AuthGuard>
        <SuggestionsView />
      </AuthGuard>
    </PageLayout>
  )
}