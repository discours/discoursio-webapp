import { RouteSectionProps, useNavigate } from '@solidjs/router'
import { onMount } from 'solid-js'
import { toast } from 'solid-sonner'
import { PageLayout } from '~/components/_shared/PageLayout'
import { EditView } from '~/components/Views/EditView'
import { ExtendedDraft, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'

/**
 * Страница редактирования локального черновика
 * @component
 */
export default function EditLocalPage(props: RouteSectionProps) {
  const { drafts, loadDrafts, setCurrentDraft } = useDrafts()
  const navigate = useNavigate()
  const { requireAuthentication } = useSession()
  const { t } = useLocalize()

  // Правильная загрузка черновика при монтировании
  onMount(() => {
    void loadDraftAsync()
  })

  const loadDraftAsync = async () => {
    await requireAuthentication(async () => {
      // Загружаем все черновики, если их еще нет
      if (!drafts().length) {
        await loadDrafts()
      }

      // Получаем id из параметра URL и проверяем, что это локальный черновик
      const draftId = props.params.id

      if (!draftId) {
        toast.error(t('Draft ID is required'))
        navigate('/edit')
        return
      }

      // Ищем локальный черновик по id
      const draft = drafts().find(
        (d: ExtendedDraft) =>
          // Проверяем либо по local_id, либо по id без draft_id (это локальный черновик)
          d.local_id === draftId || (d.id === Number(draftId) && !d.draft_id)
      )

      if (draft) {
        // Устанавливаем текущий черновик
        setCurrentDraft(draft)
      } else {
        // Если локальный черновик не найден, показываем уведомление
        toast.error(t('Local draft not found'))
        navigate('/edit')
      }
    }, 'edit')
  }

  return (
    <PageLayout title={t('Edit draft')} withPadding>
      <EditView />
    </PageLayout>
  )
}
