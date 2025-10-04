import { PageLayout } from '~/components/_shared/PageLayout'
import { AuthGuard } from '~/components/AuthGuard'
import { ProfileNotifications } from '~/components/Views/ProfileNotifications'
import { useLocalize } from '~/context/localize'

export default () => {
  const { t } = useLocalize()

  return (
    <PageLayout withPadding={true} title={`${t('Discours')} :: ${t('Notifications')}`}>
      <AuthGuard>
        <ProfileNotifications />
      </AuthGuard>
    </PageLayout>
  )
}
