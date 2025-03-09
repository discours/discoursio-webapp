import { AuthGuard } from '~/components/AuthGuard'
import { DraftsView } from '~/components/Views/DraftsView'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useLocalize } from '~/context/localize'

export default () => {
  const { t } = useLocalize()

  return (
    <PageLayout title={`${t('Discours')} :: ${t('Drafts')}`}>
      <AuthGuard>
        <DraftsView />
      </AuthGuard>
    </PageLayout>
  )
}
