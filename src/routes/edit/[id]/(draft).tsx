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
  const { currentDraft, drafts, setCurrentDraft } = useDrafts()

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
          setCurrentDraft(requestedDraft)
          return
        }

        redirect('/edit/new')
        return
      }
    )
  )

  const title = createMemo(() => {
    const layout = (currentDraft()?.layout as LayoutType) || 'article'
    if (!currentDraft()) return 'Create post'
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
        <EditView />
      </AuthGuard>
    </PageLayout>
  )
}
