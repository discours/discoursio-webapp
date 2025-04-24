import { useParams, useNavigate } from '@solidjs/router'
import { createEffect } from 'solid-js'
import { EditView } from '~/components/Views/EditView'
import { ExtendedDraft } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useSnackbar } from '~/context/ui'
import { PageLayout } from '~/components/_shared/PageLayout'
import { DraftsContext, DraftsProvider } from '~/context/drafts'
import { useContext } from 'solid-js'

export default function EditLocalPage() {
  const params = useParams()
  const { drafts, loadDrafts, setCurrentDraft } = useContext(DraftsContext)
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

      // Получаем localId из параметра URL
      const localId = params.localId

      if (!localId) {
        showSnackbar({ body: t('Draft ID is required') })
        navigate('/drafts')
        return
      }

      // Ищем черновик по localId
      const draft = drafts().find((d: ExtendedDraft) => d.localId === localId)

      if (!draft) {
        // Если черновик не найден, показываем уведомление
        showSnackbar({ body: t('Draft not found') })
        navigate('/drafts')
      } else {
        // Устанавливаем текущий черновик
        setCurrentDraft(draft)
      }
    }, 'edit')
  })

  return (
    <PageLayout title={t('Edit draft')} withPadding>
      <EditView />
    </PageLayout>
  )
} 