import { RouteSectionProps, useNavigate } from '@solidjs/router'
import { Show, createEffect, createSignal } from 'solid-js'
import { toast } from 'solid-toast'
import { DraftPreview } from '~/components/Draft/DraftPreview'
import { DraftPreviewToolbar } from '~/components/Draft/DraftPreviewToolbar'
import { PageLayout } from '~/components/_shared/PageLayout'
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

  // Загружаем черновик при монтировании
  createEffect(async () => {
    await requireAuthentication(async () => {
      setIsLoading(true)
      try {
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

        // Ищем черновик по ID
        let draft = drafts().find((d: ExtendedDraft) =>
          isLocalDraft
            ? d.localId === realDraftId || (d.isLocalOnly && d.id === Number(realDraftId))
            : d.id === Number(realDraftId)
        )

        if (draft) {
          // Синхронизируем черновик для получения последних изменений
          if (draft.id && !draft.isLocalOnly) {
            const syncedDraft = await syncDraft(draft.id)
            if (syncedDraft) {
              draft = syncedDraft
            }
          }

          // Устанавливаем черновик для предпросмотра
          setCurrentDraft(draft)
          setPreviewData(draft)
        } else {
          // Если черновик не найден, показываем уведомление
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
  })

  return (
    <PageLayout title={`${t('Discours')} :: ${t('Preview')}`} hideFooter={false}>
      <DraftPreviewToolbar />

      <Show
        when={!isLoading() && previewData()}
        fallback={<div class="container py-5">{t('Loading preview...')}</div>}
      >
        <DraftPreview previewData={previewData} />
      </Show>
    </PageLayout>
  )
}
