import { For, Show, createEffect } from 'solid-js'
import { DraftCard } from '~/components/Draft'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { Draft } from '~/graphql/schema/core.gen'

export const DraftsView = (_props: { drafts?: Draft[] }) => {
  const { requireAuthentication, client, session } = useSession()
  const { t } = useLocalize()
  const { publishDraft, deleteDraft, drafts, loadDrafts } = useDrafts()

  const handleDraftDelete = async (d: Draft) => {
    await deleteDraft(d.id)
    await loadDrafts() // Перезагружаем список после удаления
  }

  // Загружаем черновики при монтировании и при изменении сессии
  createEffect(async () => {
    console.log('[DraftsView] effect running, client:', !!client(), 'session:', !!session()?.access_token)

    if (!client()) {
      console.warn('[DraftsView] client is not ready')
      return
    }

    if (session()?.access_token) {
      console.log('[DraftsView] session is ready, loading drafts...')
      await loadDrafts()
    } else {
      console.log('[DraftsView] no session, requiring authentication...')
      await requireAuthentication(async () => {
        console.log('[DraftsView] authenticated, loading drafts...')
        await loadDrafts()
      }, 'edit')
    }
  })

  // Отслеживаем изменения в списке черновиков
  createEffect(() => {
    const currentDrafts = drafts()
    console.log('[DraftsView] drafts changed:', currentDrafts)
  })

  return (
    <div>
      <div class="wide-container">
        <div class="row offset-md-5">
          <h2>{t('Drafts')}</h2>
        </div>
        <Show
          when={drafts()?.length > 0}
          fallback={
            <div class="row">
              <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
                {t('No drafts')} (current value: {JSON.stringify(drafts())})
              </div>
            </div>
          }
        >
          <div class="row">
            <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
              <For each={drafts()}>
                {(draft: Draft) => (
                  <DraftCard
                    draft={draft as Draft}
                    onDelete={() => handleDraftDelete(draft)}
                    onPublish={() => publishDraft(draft.id)}
                  />
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
