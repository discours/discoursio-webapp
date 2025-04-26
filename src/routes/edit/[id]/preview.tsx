import { RouteSectionProps, useNavigate } from '@solidjs/router'
import { Show, createEffect, createSignal } from 'solid-js'
import { PageLayout } from '~/components/_shared/PageLayout'
import { ExtendedDraft, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useSnackbar } from '~/context/ui'

/**
 * Компонент предпросмотра черновика
 * Показывает, как будет выглядеть материал в опубликованном виде
 * @component
 */
export default function DraftPreviewPage(props: RouteSectionProps) {
  const { drafts, loadDrafts, syncDraft, setCurrentDraft } = useDrafts()
  const navigate = useNavigate()
  const { requireAuthentication } = useSession()
  const { showSnackbar } = useSnackbar()
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
          showSnackbar({ body: t('Draft ID is required') })
          navigate('/drafts')
          return
        }

        // Проверяем, является ли это локальным черновиком
        const isLocalDraft = draftId.startsWith('local-') || window.location.pathname.includes('/local/')
        const realDraftId = isLocalDraft ? draftId.replace('local-', '') : draftId

        // Ищем черновик по ID
        let draft = drafts().find((d: ExtendedDraft) => 
          isLocalDraft 
            ? (d.localId === realDraftId || (d.isLocalOnly && d.id === Number(realDraftId)))
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
          showSnackbar({ body: t('Draft not found') })
          navigate('/drafts')
        }
      } catch (error) {
        console.error('[DraftPreviewPage] Error loading draft:', error)
        showSnackbar({ body: t('Error loading draft') })
      } finally {
        setIsLoading(false)
      }
    }, 'edit')
  })

  /**
   * Обработчик кнопки "Редактировать"
   */
  const handleEditClick = () => {
    const draft = previewData()
    if (!draft) return

    if (draft.isLocalOnly) {
      navigate(`/edit/${draft.localId || draft.id}/local`)
    } else {
      navigate(`/edit/${draft.id}`)
    }
  }

  /**
   * Обработчик кнопки "Опубликовать"
   */
  const handlePublishClick = () => {
    const draft = previewData()
    if (!draft || !draft.id) return
    
    navigate(`/edit/${draft.id}/settings`)
  }

  /**
   * Рендер панели инструментов предпросмотра
   */
  const renderPreviewToolbar = () => {
    return (
      <div class="preview-toolbar">
        <div class="container">
          <div class="preview-toolbar__inner">
            <div class="preview-toolbar__title">
              {t('Preview Mode')} 
              <span class="preview-toolbar__subtitle">
                {t('This is how your post will look when published')}
              </span>
            </div>
            <div class="preview-toolbar__actions">
              <button 
                class="btn btn-outline-primary btn-sm" 
                onClick={handleEditClick}
              >
                {t('Edit')}
              </button>
              <button 
                class="btn btn-primary btn-sm ml-2" 
                onClick={handlePublishClick}
              >
                {t('Publish')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PageLayout title={`${t('Discours')} :: ${t('Preview')}`} hideFooter={false}>
      {renderPreviewToolbar()}
      
      <Show when={!isLoading() && previewData()} fallback={<div class="container py-5">{t('Loading preview...')}</div>}>
        <div class="container py-4">
          <div class="row">
            <div class="col-md-16 col-lg-14 col-xl-12 offset-xl-4 offset-lg-3 offset-md-2">
              <article class="article">
                <Show when={previewData()?.cover}>
                  <div class="article__cover">
                    <img src={previewData()?.cover || ''} alt={previewData()?.title || ''} />
                  </div>
                </Show>
                
                <h1 class="article__title">{previewData()?.title || t('Unnamed draft')}</h1>
                
                <Show when={previewData()?.subtitle}>
                  <h2 class="article__subtitle">{previewData()?.subtitle}</h2>
                </Show>
                
                <Show when={previewData()?.lead}>
                  <div class="article__lead" innerHTML={previewData()?.lead || ''} />
                </Show>
                
                <div class="article__content" innerHTML={previewData()?.body || ''} />
              </article>
            </div>
          </div>
        </div>
      </Show>
    </PageLayout>
  )
}

