import { AuthGuard } from '~/components/AuthGuard'
import { EditSettingsView } from '~/components/Views/EditSettingsView'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useLocalize } from '~/context/localize'

export default () => {
  const { t } = useLocalize()

  return (
    <PageLayout title={`${t('Discours')} :: ${t('Publication settings')}`}>
      <AuthGuard>
        <EditSettingsView />
      </AuthGuard>
    </PageLayout>
  )
}
