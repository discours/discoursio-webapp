import { AuthGuard } from '~/components/AuthGuard'
import { LayoutSelector } from '~/components/Draft/LayoutSelector'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useLocalize } from '~/context/localize'

export default () => {
  const { t } = useLocalize()

  return (
    <PageLayout
      title={`${t('Discours')} :: ${t('Choose a post type')}`}
      key="home"
      desc={t('Participate in the Discours: share information, join the editorial team')}
    >
      <AuthGuard>
        <LayoutSelector />
      </AuthGuard>
    </PageLayout>
  )
}
