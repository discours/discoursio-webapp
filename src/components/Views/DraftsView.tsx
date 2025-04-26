import { For, Show, createEffect, on } from 'solid-js'
import { DraftCard } from '~/components/Draft'
import { ExtendedDraft, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useSnackbar } from '~/context/ui'
import { Draft } from '~/graphql/schema/core.gen'

import styles from '~/styles/views/DraftsView.module.scss'

export const DraftsView = (_props: { drafts?: Draft[] }) => {
  const { requireAuthentication, session } = useSession()
  const { t } = useLocalize()
  const { publishDraft, deleteDraft, drafts, loadDrafts, removeLocalDraft } = useDrafts()
  const { showSnackbar } = useSnackbar()

  const handleDraftDelete = async (d: Draft | ExtendedDraft) => {
    // Проверяем, является ли черновик только локальным
    const isLocalOnly = 'isLocalOnly' in d && d.isLocalOnly === true

    try {
      if (d?.id) {
        console.log('[DraftsView] deleting draft:', d.id, isLocalOnly ? '(local only)' : '')

        if (isLocalOnly) {
          // Удаляем локальный черновик
          removeLocalDraft(d.id)
        } else {
          // Удаляем черновик на сервере
          await deleteDraft(d.id)
        }
      } else {
        // Для черновиков без ID (временные локальные) просто логируем ошибку
        // Это временное решение, пока не будет добавлена правильная обработка
        console.error('[DraftsView] Draft has no id:', d)
      }

      // Перезагружаем список после удаления
      await loadDrafts()
    } catch (error) {
      console.error('[DraftsView] Error deleting draft:', error)
      showSnackbar({
        body: t('Error deleting draft')
      })
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
          <div class="col-md-14 col-lg-12 col-xl-10 offset-md-7">
            <div class={styles.draftsHeader}>
              <h2>{t('Drafts')}</h2>
            </div>

            <Show
              when={drafts()?.length > 0}
              fallback={<div class={styles.noDrafts}>{t('No drafts')}</div>}
            >
              <div class={styles.draftsList}>
                <For each={drafts()}>
                  {(draft) => (
                    <div class={styles.draftCardContainer}>
                      <DraftCard
                        draft={draft}
                        onDelete={() => handleDraftDelete(draft)}
                        onPublish={() => publishDraft(draft.id)}
                      />
                    </div>
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
