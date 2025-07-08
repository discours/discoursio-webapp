import { RouteSectionProps, redirect } from '@solidjs/router'
import { createEffect, createMemo, lazy, on } from 'solid-js'
import { PageLayout } from '~/components/_shared/PageLayout'
import { AuthGuard } from '~/components/AuthGuard'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { Draft } from '~/graphql/generated/graphql'
import { LayoutType } from '~/types/nav'

const EditView = lazy(() => import('~/components/Views/EditView'))

export default (props: RouteSectionProps) => {
  const { t } = useLocalize()
  const { drafts, setCurrentDraft, getEditorContent, setEditorContent } = useDrafts()

  /**
   * Эффект для загрузки черновика и его содержимого в редактор
   */
  createEffect(
    on(
      () => props.params.id,
      (draftId: string) => {
        if (!draftId) {
          redirect('/edit/new')
          return
        }

        const parsedId = Number.parseInt(draftId)
        const draftsArray = drafts()

        if (!draftsArray || !Array.isArray(draftsArray)) return

        const requestedDraft = draftsArray.find((draft: Draft) => draft.id === parsedId)

        if (requestedDraft) {
          console.log(`[EditDraft] Setting current draft: ${requestedDraft.id}`)
          setCurrentDraft(requestedDraft)

          const editorId = `draft-${requestedDraft.id}-body`
          const currentContent = getEditorContent(editorId)

          if (!currentContent && requestedDraft.body) {
            console.log(`[EditDraft] Setting editor content for ${editorId}`)
            setEditorContent(editorId, requestedDraft.body)
          }

          const leadEditorId = `draft-${requestedDraft.id}-lead`
          const currentLeadContent = getEditorContent(leadEditorId)

          if (!currentLeadContent && requestedDraft.lead) {
            console.log(`[EditDraft] Setting editor content for ${leadEditorId}`)
            setEditorContent(leadEditorId, requestedDraft.lead)
          }
        } else {
          console.warn(`Draft with id=${parsedId} not found`)
          // redirect('/edit')
        }
      }
    )
  )

  const title = createMemo(() => {
    const currentDraftId = props.params.id ? Number.parseInt(props.params.id) : 0
    const draftsArray = drafts()
    const currentDraft = Array.isArray(draftsArray)
      ? draftsArray.find((draft: Draft) => draft.id === currentDraftId)
      : undefined

    const layout = (currentDraft?.layout as LayoutType) || 'article'

    if (!currentDraft) return 'Create post'

    return (
      {
        article: 'Write an article',
        audio: 'Publish Album',
        image: 'Create gallery',
        video: 'Create video',
        literature: 'New literary work'
      }[layout] || 'Write an article'
    )
  })

  // Получение текущего черновика для передачи в EditView
  const currentDraftForEdit = () => {
    const currentDraftId = props.params.id ? Number.parseInt(props.params.id) : 0
    const draftsArray = drafts()

    if (!Array.isArray(draftsArray)) return undefined

    return draftsArray.find((draft: Draft) => draft.id === currentDraftId)
  }

  return (
    <PageLayout title={`${t('Discours')} :: ${t(title())}`} hideFooter={true}>
      <AuthGuard>
        <EditView draft={currentDraftForEdit()} />
      </AuthGuard>
    </PageLayout>
  )
}
