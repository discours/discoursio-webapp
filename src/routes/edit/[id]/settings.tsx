import { RouteSectionProps, redirect } from '@solidjs/router'
import { createEffect, on } from 'solid-js'
import { AuthGuard } from '~/components/AuthGuard'
import { EditSettingsView } from '~/components/Views/EditSettingsView'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { Draft } from '~/graphql/schema/core.gen'

export default (props: RouteSectionProps) => {
  const { t } = useLocalize()
  const { drafts, setCurrentDraft } = useDrafts()

  /**
   * Эффект для загрузки черновика при открытии настроек публикации
   */
  createEffect(
    on(
      () => props.params.id,
      (draftId: string) => {
        if (!draftId) {
          redirect('/edit')
          return
        }

        const parsedId = Number.parseInt(draftId)
        const draftsArray = drafts()

        if (!draftsArray || !Array.isArray(draftsArray)) return

        const requestedDraft = draftsArray.find((draft: Draft) => draft.id === parsedId)

        if (requestedDraft) {
          console.log(`[EditSettingsRoute] Setting current draft: ${requestedDraft.id}`)
          setCurrentDraft(requestedDraft)
        } else {
          console.warn(`[EditSettingsRoute] Draft with id=${parsedId} not found`)
          redirect('/edit')
        }
      }
    )
  )

  return (
    <PageLayout title={`${t('Discours')} :: ${t('Publication settings')}`} hideFooter={true}>
      <AuthGuard>
        <EditSettingsView />
      </AuthGuard>
    </PageLayout>
  )
}
