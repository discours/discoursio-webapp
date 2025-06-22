import { RouteSectionProps } from '@solidjs/router'
import { PageLayout } from '~/components/_shared/PageLayout'
import { AuthGuard } from '~/components/AuthGuard'
import { SuggestionsView } from '~/components/Views/SuggestionsView'
import { useLocalize } from '~/context/localize'

export const Suggest = (props: RouteSectionProps) => {
  const { t } = useLocalize()

  return (
    <PageLayout title={`${t('Discours')} :: ${t('Suggestions')}`} hideFooter={false}>
      <AuthGuard disabled={true}>
        <SuggestionsView shoutId={Number.parseInt(props.params.id, 10)} />
      </AuthGuard>
    </PageLayout>
  )
}
