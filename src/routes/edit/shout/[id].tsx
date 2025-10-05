import { RouteSectionProps, useNavigate } from '@solidjs/router'
import { onMount } from 'solid-js'
import { toast } from 'solid-sonner'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'

/**
 * Роут для редактирования опубликованного шаута.
 * Создаёт черновик из шаута (если его ещё нет) и редиректит на страницу редактирования черновика.
 */
export default function EditShoutPage(props: RouteSectionProps) {
  const { t } = useLocalize()
  const { requireAuthentication } = useSession()
  const { createDraftFromShout, drafts } = useDrafts()
  const navigate = useNavigate()

  onMount(() => {
    void loadShoutAndCreateDraft()
  })

  const loadShoutAndCreateDraft = async () => {
    await requireAuthentication(async () => {
      const shoutId = props.params.id

      if (!shoutId) {
        toast.error(t('Shout ID is required'))
        navigate('/edit')
        return
      }

      const parsedShoutId = Number.parseInt(shoutId, 10)

      if (Number.isNaN(parsedShoutId)) {
        toast.error(t('Invalid shout ID'))
        navigate('/edit')
        return
      }

      console.log('[EditShout] Creating/loading draft for shout:', parsedShoutId)

      try {
        // Сначала проверяем, может уже есть черновик для этого шаута
        const existingDraft = drafts().find((d) => d.shout_id === parsedShoutId)

        if (existingDraft) {
          console.log('[EditShout] Draft already exists:', existingDraft.id)
          navigate(`/edit/${existingDraft.id}`)
          return
        }

        // Создаём черновик из шаута
        const result = await createDraftFromShout(parsedShoutId)

        if (result?.error) {
          console.error('[EditShout] GraphQL error:', result.error)
          toast.error(t('Failed to create draft from shout'))
          navigate('/')
          return
        }

        if (result?.data?.create_draft_from_shout?.error) {
          const error = result.data.create_draft_from_shout.error
          console.error('[EditShout] Server error:', error)

          // Проверяем, не является ли это ошибкой авторизации
          if (error.includes('not authorized')) {
            toast.error(t('You are not authorized to edit this shout'))
          } else {
            toast.error(t('Failed to create draft: ') + error)
          }

          navigate('/')
          return
        }

        const draft = result?.data?.create_draft_from_shout?.draft

        if (draft?.id) {
          console.log('[EditShout] Draft created successfully:', draft.id)
          toast.success(t('Draft created, redirecting to editor...'))
          navigate(`/edit/${draft.id}`)
        } else {
          console.error('[EditShout] No draft in response')
          toast.error(t('Failed to create draft'))
          navigate('/')
        }
      } catch (error) {
        console.error('[EditShout] Error:', error)
        toast.error(t('An error occurred while creating draft'))
        navigate('/')
      }
    }, 'edit')
  }

  return (
    <PageLayout title={`${t('Discours')} :: ${t('Loading...')}`} withPadding>
      <div style={{ padding: '2rem', 'text-align': 'center' }}>
        <p>{t('Creating draft from shout...')}</p>
      </div>
    </PageLayout>
  )
}
