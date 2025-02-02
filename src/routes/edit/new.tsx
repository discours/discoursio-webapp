import { AuthGuard } from '~/components/AuthGuard'
import { LayoutSelector } from '~/components/Draft/LayoutSelector'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useLocalize } from '~/context/localize'
import { useEditorContext } from '~/context/editor'
import { Show } from 'solid-js'

export default () => {
  const { t } = useLocalize()
  const { isReady } = useEditorContext()

  return (
    <PageLayout
      title={`${t('Discours')} :: ${t('Choose a post type')}`}
      key="home"
      desc={t('Participate in the Discours: share information, join the editorial team')}
    >
      <AuthGuard>
        <Show 
          when={isReady()} 
          fallback={<div>Loading...</div>}
        >
          <LayoutSelector />
        </Show>
      </AuthGuard>
    </PageLayout>
  )
}
