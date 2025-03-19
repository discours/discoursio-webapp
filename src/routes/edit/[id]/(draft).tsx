import { RouteSectionProps, redirect } from '@solidjs/router'
import { createEffect, createMemo, lazy, on } from 'solid-js'
import { AuthGuard } from '~/components/AuthGuard'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { Draft } from '~/graphql/schema/core.gen'
import { LayoutType } from '~/types/common'

const EditView = lazy(() => import('~/components/Views/EditView'))

export default (props: RouteSectionProps) => {
  const { t } = useLocalize()
  const { drafts, setCurrentDraft, getEditorContent, setEditorContent } = useDrafts()

  /**
   * Эффект для загрузки черновика и его содержимого в редактор
   *
   * @example
   * ```
   * // Триггерится при изменении параметра id в URL
   * // Устанавливает текущий черновик и его содержимое
   * ```
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
        const requestedDraft = drafts()?.find((draft: Draft) => draft.id === parsedId)
        if (requestedDraft) {
          console.log(
            '[edit/[id]] Found draft:',
            requestedDraft.id,
            requestedDraft.title,
            'Body length:',
            requestedDraft.body?.length || 0
          )
          setCurrentDraft(requestedDraft)

          // Всегда устанавливаем содержимое черновика в редактор независимо от того,
          // есть ли уже содержимое в редакторе
          if (requestedDraft.body) {
            const bodyEditorId = `draft-${requestedDraft.id}-body`
            console.log('[edit/[id]] Setting editor content for body, length:', requestedDraft.body.length)
            setEditorContent(bodyEditorId, requestedDraft.body)
            console.log('[edit/[id]] After setting content:', getEditorContent(bodyEditorId)?.length || 0)
          } else {
            console.log('[edit/[id]] Draft has no body content')
          }

          // Загружаем лид в редактор
          if (requestedDraft.lead) {
            const leadEditorId = `draft-${requestedDraft.id}-lead`
            console.log('[edit/[id]] Setting editor content for lead, length:', requestedDraft.lead.length)
            setEditorContent(leadEditorId, requestedDraft.lead)
            console.log(
              '[edit/[id]] After setting lead content:',
              getEditorContent(leadEditorId)?.length || 0
            )
          } else {
            console.log('[edit/[id]] Draft has no lead content')
          }

          return
        }

        redirect('/edit/new')
        return
      }
    )
  )

  const title = createMemo(() => {
    const currentDraft = drafts()?.find((draft: Draft) => draft.id === Number.parseInt(props.params.id))
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

  return (
    <PageLayout title={`${t('Discours')} :: ${t(title())}`}>
      <AuthGuard>
        <EditView
          draft={drafts()?.find((draft: Draft) => draft.id === Number.parseInt(props.params.id)) as Draft}
        />
      </AuthGuard>
    </PageLayout>
  )
}
