import { PageLayout } from '~/components/_shared/PageLayout'
import { AuthGuard } from '~/components/AuthGuard'
import { ProfileSecurityView } from '~/components/Views/ProfileSecurity'
import { useLocalize } from '~/context/localize'
import { ProfileProvider } from '~/context/profile'

export default () => {
  const { t } = useLocalize()
  return (
    <PageLayout withPadding={true} title={`${t('Discours')} :: ${t('Security')}`}>
      <AuthGuard>
        <ProfileProvider>
          <ProfileSecurityView />
        </ProfileProvider>
      </AuthGuard>
    </PageLayout>
  )
}
