import { RouteSectionProps } from '@solidjs/router'

import { Show, createSignal } from 'solid-js'
import { AuthGuard } from '~/components/AuthGuard'
import { SuggestionsView } from '~/components/Views/SuggestionsView'
import { PageLayout } from '~/components/_shared/PageLayout'
import { ExtendedDraft } from '~/context/drafts'
import { useLocalize } from '~/context/localize'

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