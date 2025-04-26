import { For, Show, createEffect, createSignal, on, onMount } from 'solid-js'
import { toast } from 'solid-toast'
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
  const [isLoading, setIsLoading] = createSignal(true)

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
      toast(t('Error deleting draft'), {
        icon: 'error'
      })
    }
  }

  // Отслеживаем состояние черновиков
  createEffect(() => {
    console.log('[DraftsView] current drafts:', drafts())
  })

  // Функция загрузки данных черновиков
  const loadData = async () => {
    setIsLoading(true)
    try {
      await loadDrafts()
      console.log('[DraftsView] drafts loaded')
    } catch (error) {
      console.error('[DraftsView] Error loading drafts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Загружаем черновики при монтировании и при изменении сессии
  createEffect(
    on(
      () => session()?.access_token,
      async (token: string | undefined, prevToken: string | undefined) => {
        console.log('[DraftsView] token changed:', { token: !!token, prevToken: !!prevToken })

        if (token) {
          console.log('[DraftsView] session is ready, loading drafts...')
          try {
            await loadData()
          } catch (err) {
            console.error('[DraftsView] Failed to load drafts:', err)
          }
        } else {
          console.log('[DraftsView] no session, requiring authentication...')
          try {
            await requireAuthentication(async () => {
              console.log('[DraftsView] authenticated, loading drafts...')
              await loadData()
            }, 'edit')
          } catch (err) {
            console.error('[DraftsView] Authentication failed:', err)
          }
        }
      },
      {}
    )
  ) // Убираем defer чтобы эффект сработал сразу

  // Загрузка данных при монтировании компонента
  onMount(() => {
    loadData()
  })

  return (
    <div class={styles.draftsView}>
      <div class="wide-container">
        <div class="row">
          <div class="col-md-14 col-lg-12 col-xl-10 offset-md-7">
            <div class={styles.draftsHeader}>
              <h2>{t('Drafts')}</h2>
            </div>

            <Show
              when={!isLoading() && drafts()?.length > 0}
              fallback={
                <div class={styles.noDrafts}>{isLoading() ? t('Loading drafts...') : t('No drafts')}</div>
              }
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
