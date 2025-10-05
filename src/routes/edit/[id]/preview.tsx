import { RouteSectionProps, useNavigate } from '@solidjs/router'
import { createSignal, onMount, Show } from 'solid-js'
import { toast } from 'solid-sonner'
import { PageLayout } from '~/components/_shared/PageLayout'
import { DraftPreview } from '~/components/Draft/DraftPreview'
import { DraftPreviewToolbar } from '~/components/Draft/DraftPreviewToolbar'
import { ExtendedDraft, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'

/**
 * Компонент предпросмотра черновика
 * Показывает, как будет выглядеть материал в опубликованном виде
 * @component
 */
export default function DraftPreviewPage(props: RouteSectionProps) {
  const { drafts, loadDrafts, syncDraft, setCurrentDraft } = useDrafts()
  const navigate = useNavigate()
  const { requireAuthentication } = useSession()
  const { t } = useLocalize()
  const [isLoading, setIsLoading] = createSignal(true)
  const [previewData, setPreviewData] = createSignal<ExtendedDraft | null>(null)
  const [isSyncAttempted, setIsSyncAttempted] = createSignal(false)

  // Правильная загрузка черновика при монтировании
  onMount(() => {
    // Предотвращаем повторные вызовы, если синхронизация уже выполнялась
    if (isSyncAttempted()) return
    void loadPreviewAsync()
  })

  const loadPreviewAsync = async () => {
    await requireAuthentication(async () => {
      setIsLoading(true)
      try {
        // Помечаем, что попытка синхронизации началась
        setIsSyncAttempted(true)

        // Загружаем все черновики, если их еще нет
        if (!drafts().length) {
          await loadDrafts()
        }

        // Получаем id из параметра URL
        const draftId = props.params.id

        if (!draftId) {
          toast.error(t('Draft ID is required'))
          navigate('/edit')
          return
        }

        // Проверяем, является ли это локальным черновиком
        const isLocalDraft = draftId.startsWith('local-') || window.location.pathname.includes('/local/')
        const realDraftId = isLocalDraft ? draftId.replace('local-', '') : draftId

        // Ищем черновик по ID с улучшенной логикой
        let draft = drafts().find((d: ExtendedDraft) => {
          // Для локальных драфтов
          if (isLocalDraft) {
            return d.local_id === realDraftId || (!d.draft_id && d.id === Number(realDraftId))
          }
          // Для серверных драфтов
          return d.id === Number(realDraftId)
        })

        // Если не найден, попробуем найти по другим критериям
        if (!draft) {
          // Попробуем найти по local_id если это не локальный драфт
          if (!isLocalDraft) {
            draft = drafts().find((d: ExtendedDraft) => d.local_id === draftId)
          }

          // Попробуем найти по числовому ID
          if (!draft && !Number.isNaN(Number(draftId))) {
            draft = drafts().find((d: ExtendedDraft) => d.id === Number(draftId))
          }
        }

        if (draft) {
          // Устанавливаем черновик для предпросмотра сразу (для быстрого отображения)
          setCurrentDraft(draft)
          setPreviewData(draft)

          try {
            // Синхронизируем черновик для получения последних изменений, но только для нелокальных черновиков
            if (draft.id && draft.draft_id) {
              const syncedDraft = await syncDraft(draft.id)

              // Обновляем данные только если синхронизация успешна
              if (syncedDraft) {
                draft = syncedDraft
                setCurrentDraft(draft)
                setPreviewData(draft)
              }
            }
          } catch (syncError) {
            console.error('[DraftPreviewPage] Error syncing draft:', syncError)
            // Продолжаем с существующим черновиком, если синхронизация не удалась
          }
        } else {
          // Если черновик не найден, показываем уведомление с деталями
          console.error('[DraftPreviewPage] Драфт не найден:', {
            searchedId: draftId,
            availableDrafts: drafts().map((d) => ({ id: d.id, local_id: d.local_id, title: d.title }))
          })
          toast.error(t('Draft not found'))
          navigate('/edit')
        }
      } catch (error) {
        console.error('[DraftPreviewPage] Error loading draft:', error)
        toast.error(t('Error loading draft'))
      } finally {
        setIsLoading(false)
      }
    }, 'edit')
  }

  return (
    <PageLayout title={`${t('Discours')} :: ${t('Preview')}`} hideFooter={false}>
      <DraftPreviewToolbar />

      <Show when={!isLoading() && previewData()} fallback={<div class="container py-5">{t('Loading preview...')}</div>}>
        <DraftPreview previewData={previewData} />
      </Show>
    </PageLayout>
  )
}
