import { RouteSectionProps, useNavigate } from '@solidjs/router'
import { createEffect } from 'solid-js'
import { EditView } from '~/components/Views/EditView'
import { PageLayout } from '~/components/_shared/PageLayout'
import { ExtendedDraft, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useSnackbar } from '~/context/ui'

/**
 * Страница редактирования локального черновика
 * @component
 */
export default function EditLocalPage(props: RouteSectionProps) {
  const { drafts, loadDrafts, setCurrentDraft } = useDrafts()
  const navigate = useNavigate()
  const { requireAuthentication } = useSession()
  const { showSnackbar } = useSnackbar()
  const { t } = useLocalize()

  // Загружаем черновик при монтировании
  createEffect(async () => {
    await requireAuthentication(async () => {
      // Загружаем все черновики, если их еще нет
      if (!drafts().length) {
        await loadDrafts()
      }

      // Получаем id из параметра URL и проверяем, что это локальный черновик
      const draftId = props.params.id

      if (!draftId) {
        showSnackbar({ body: t('Draft ID is required') })
        navigate('/drafts')
        return
      }

      // Ищем локальный черновик по id
      const draft = drafts().find(
        (d: ExtendedDraft) =>
          // Проверяем либо по localId, либо по id с флагом isLocalOnly
          d.localId === draftId || (d.id === Number(draftId) && d.isLocalOnly === true)
      )

      if (draft) {
        // Устанавливаем текущий черновик
        setCurrentDraft(draft)
      } else {
        // Если локальный черновик не найден, показываем уведомление
        showSnackbar({ body: t('Local draft not found') })
        navigate('/drafts')
      }
    }, 'edit')
  })

  return (
    <PageLayout title={t('Edit draft')} withPadding>
      <EditView />
    </PageLayout>
  )
}
