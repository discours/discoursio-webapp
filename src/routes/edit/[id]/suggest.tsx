import { AuthGuard } from '~/components/AuthGuard'
import { SuggestionsView } from '~/components/Views/SuggestionsView'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useLocalize } from '~/context/localize'

export const Suggest = () => {
  const { t } = useLocalize()

  return (
    <PageLayout title={`${t('Discours')} :: ${t('Suggestions')}`} hideFooter={false}>
      <AuthGuard>
        <SuggestionsView />
      </AuthGuard>
    </PageLayout>
  )
}
