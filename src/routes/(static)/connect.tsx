import { PageLayout } from '~/components/_shared/PageLayout'
import { ConnectView } from '~/components/Views/ConnectView'
import { useLocalize } from '~/context/localize'

export default () => {
  const { t } = useLocalize()
  return (
    <PageLayout title={t('Suggest an idea')}>
      <ConnectView />
    </PageLayout>
  )
}
