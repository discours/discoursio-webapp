import { For, Show, createEffect, createSignal, on } from 'solid-js'
import { A } from '@solidjs/router'
import { DraftCard } from '~/components/Draft'
import { ExtendedDraft, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useUI, useSnackbar } from '~/context/ui'
import { Icon } from '~/components/_shared/Icon'
import { Draft } from '~/graphql/schema/core.gen'
import { clsx } from 'clsx'

import styles from '~/styles/views/DraftsView.module.scss'

export const DraftsView = (_props: { drafts?: Draft[] }) => {
  const { requireAuthentication, session } = useSession()
  const { t, formatDate } = useLocalize()
  const { publishDraft, deleteDraft, drafts, loadDrafts, removeLocalDraft } = useDrafts()
  const { showConfirm } = useUI()
  const { showSnackbar } = useSnackbar()
  const [selectedDrafts, setSelectedDrafts] = createSignal<number[]>([])

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

  const toggleSelection = (draftId: number) => {
    setSelectedDrafts(prev => {
      if (prev.includes(draftId)) {
        return prev.filter(id => id !== draftId)
      } else {
        return [...prev, draftId]
      }
    })
  }

  const toggleAllSelection = () => {
    if (selectedDrafts().length === drafts().length) {
      setSelectedDrafts([])
    } else {
      setSelectedDrafts(drafts().map(d => d.id))
    }
  }

  const deleteSelectedDrafts = async () => {
    if (selectedDrafts().length === 0) return

    const isConfirmed = await showConfirm({
      confirmBody: t('Are you sure you want to delete selected drafts?'),
      confirmButtonLabel: t('Delete'),
      confirmButtonVariant: 'danger',
      declineButtonVariant: 'primary'
    })

    if (isConfirmed) {
      const draftIds = selectedDrafts()
      for (const id of draftIds) {
        const draft = drafts().find(d => d.id === id)
        if (draft) {
          await handleDraftDelete(draft)
        }
      }
      setSelectedDrafts([])
      await showSnackbar({ body: t('Selected drafts deleted') })
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
              
              <div class={styles.draftsControls}>
                <Show when={selectedDrafts().length > 0}>
                  <button 
                    class={styles.deleteSelected}
                    onClick={deleteSelectedDrafts}
                    title={t('Delete selected')}
                  >
                    <Icon name="trash" />
                    {t('Delete selected')} ({selectedDrafts().length})
                  </button>
                </Show>
              </div>
            </div>

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
