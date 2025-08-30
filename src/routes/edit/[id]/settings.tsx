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
  const { drafts, loadDrafts, setCurrentDraft, syncDraft } = useDrafts()
  const { requireAuthentication } = useSession()

  // Мемоизируем ID черновика, чтобы избежать лишних вычислений
  const draftId = createMemo(() => props.params.id)

  /**
   * Эффект для загрузки черновика при открытии настроек публикации
   * Синхронизируем данные из localStorage только один раз
   */
  createEffect(
    on(
      [draftId, drafts],
      async ([id]) => {
        const strId = id as string
        if (!strId) {
          redirect('/edit')
          return
        }

        const parsedId = Number.parseInt(strId, 10)
        const draftsArray = drafts()

        if (!draftsArray || !Array.isArray(draftsArray)) return

        const requestedDraft = draftsArray.find((draft: Draft) => draft.id === parsedId)

        if (requestedDraft) {
          console.log(`[EditSettingsRoute] Found draft: ${requestedDraft.id}, syncing from localStorage...`)

          // 🔧 ИСПРАВЛЕНИЕ: Синхронизируем данные из localStorage только один раз
          try {
            const syncedDraft = await syncDraft(parsedId)

            if (syncedDraft) {
              console.log(`[EditSettingsRoute] Setting synced draft: ${syncedDraft.id}`)
              setCurrentDraft(syncedDraft)
            } else {
              console.log(`[EditSettingsRoute] Sync failed, using original draft: ${requestedDraft.id}`)
              setCurrentDraft(requestedDraft)
            }
          } catch (error) {
            console.error('[EditSettingsRoute] Sync error:', error)
            setCurrentDraft(requestedDraft)
          }
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
