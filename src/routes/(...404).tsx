import { PageLayout } from '../components/_shared/PageLayout'
import { FourOuFourView } from '../components/Views/FourOuFour'
import { useLocalize } from '../context/localize'

export const FourOuFourPage = () => {
  const { t } = useLocalize()

  return (
    <PageLayout isHeaderFixed={false} hideFooter={true} title={t('Nothing is here')}>
      <FourOuFourView />
    </PageLayout>
  )
}

export default FourOuFourPage
