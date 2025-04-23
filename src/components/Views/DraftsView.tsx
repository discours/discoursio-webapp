import { For, Show, createEffect, on } from 'solid-js'
import { DraftCard } from '~/components/Draft'
import { ExtendedDraft, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { Draft } from '~/graphql/schema/core.gen'

import styles from '~/styles/views/DraftsView.module.scss'

export const DraftsView = (_props: { drafts?: Draft[] }) => {
  const { requireAuthentication, session } = useSession()
  const { t } = useLocalize()
  const { publishDraft, deleteDraft, drafts, loadDrafts, removeLocalDraft } = useDrafts()

  const handleDraftDelete = async (d: Draft | ExtendedDraft) => {
    // Проверяем, является ли черновик только локальным
    const isLocalOnly = 'isLocalOnly' in d && d.isLocalOnly === true

    if (d?.id) {
      console.log('[DraftsView] deleting draft:', d.id, isLocalOnly ? '(local only)' : '')

      if (isLocalOnly) {
        // Удаляем локальный черновик
        removeLocalDraft(d.id)
      } else {
        // Удаляем черновик на сервере
        await deleteDraft(d.id)
      }

      await loadDrafts() // Перезагружаем список после удаления
    } else {
      console.error('[DraftsView] Draft has no id:', d)
    }
  }

  // Отслеживаем состояние черновиков
  createEffect(() => {
    console.log('[DraftsView] current drafts:', drafts())
  })

  // Загружаем черновики при монтировании и при изменении сессии
  createEffect(
    on(
      () => session()?.access_token,
      async (token, prevToken) => {
        console.log('[DraftsView] token changed:', { token: !!token, prevToken: !!prevToken })

        if (token) {
          console.log('[DraftsView] session is ready, loading drafts...')
          try {
            await loadDrafts()
          } catch (err) {
            console.error('[DraftsView] Failed to load drafts:', err)
          }
        } else {
          console.log('[DraftsView] no session, requiring authentication...')
          try {
            await requireAuthentication(async () => {
              console.log('[DraftsView] authenticated, loading drafts...')
              await loadDrafts()
            }, 'edit')
          } catch (err) {
            console.error('[DraftsView] Authentication failed:', err)
          }
        }
      },
      {}
    )
  ) // Убираем defer чтобы эффект сработал сразу

  return (
    <div class={styles.draftsView}>
      <div class="wide-container">
        <div class="row">
          <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
            <h2>{t('Drafts')}</h2>

            <Show
              when={drafts()?.length > 0}
              fallback={<div class={styles.noDrafts}>{t('No drafts')}</div>}
            >
              <div class={styles.draftsList}>
                <For each={drafts()}>
                  {(draft) => (
                    <DraftCard
                      draft={draft}
                      onDelete={() => handleDraftDelete(draft)}
                      onPublish={() => publishDraft(draft.id)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}
