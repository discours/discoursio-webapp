import { RouteSectionProps, redirect } from '@solidjs/router'
import { createEffect, createMemo, on, onMount } from 'solid-js'
import { PageLayout } from '~/components/_shared/PageLayout'
import { AuthGuard } from '~/components/AuthGuard'
import { EditSettingsView } from '~/components/Views/EditSettingsView'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { Draft } from '~/graphql/generated/graphql'

export default (props: RouteSectionProps) => {
  const { t } = useLocalize()
  const { drafts, loadDrafts, setCurrentDraft } = useDrafts()
  const { requireAuthentication } = useSession()

  // Мемоизируем ID черновика, чтобы избежать лишних вычислений
  const draftId = createMemo(() => props.params.id)

  /**
   * Эффект для загрузки черновика при открытии настроек публикации
   * Используем defer: true чтобы предотвратить каскадные обновления
   */
  createEffect(
    on(
      [draftId, drafts],
      ([id]) => {
        const strId = id as string
        if (!strId) {
          redirect('/edit')
          return
        }

        const parsedId = Number.parseInt(strId)
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
      },
      { defer: true }
    )
  )

  onMount(() => {
    void requireAuthentication(async () => {
      if (!Array.isArray(drafts()) || drafts().length === 0) {
        await loadDrafts()
      }
    }, 'edit')
  })

  // Мемоизируем заголовок страницы
  const pageTitle = createMemo(() => `${t('Discours')} :: ${t('Publication settings')}`)

  return (
    <PageLayout title={pageTitle()} hideFooter={true}>
      <AuthGuard>
        <EditSettingsView />
      </AuthGuard>
    </PageLayout>
  )
}
