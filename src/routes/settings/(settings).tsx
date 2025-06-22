import { PageLayout } from '~/components/_shared/PageLayout'
import { AuthGuard } from '~/components/AuthGuard'
import { ProfileSettings } from '~/components/Views/ProfileSettings'
import { useLocalize } from '~/context/localize'
import { ProfileProvider } from '~/context/profile'

export default () => {
  const { t } = useLocalize()

  return (
    <PageLayout withPadding={true} title={`${t('Discours')} :: ${t('Profile')}`}>
      <AuthGuard>
        <ProfileProvider>
          <ProfileSettings />
        </ProfileProvider>
      </AuthGuard>
    </PageLayout>
  )
}
