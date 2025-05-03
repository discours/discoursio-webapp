import { RouteSectionProps, redirect } from '@solidjs/router'
import { createEffect, createMemo, on } from 'solid-js'
import { AuthGuard } from '~/components/AuthGuard'
import { EditSettingsView } from '~/components/Views/EditSettingsView'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { Draft } from '~/graphql/schema/core.gen'

export default (props: RouteSectionProps) => {
  const { t } = useLocalize()
  const { drafts, setCurrentDraft } = useDrafts()

  // Мемоизируем ID черновика, чтобы избежать лишних вычислений
  const draftId = createMemo(() => props.params.id)

  /**
   * Эффект для загрузки черновика при открытии настроек публикации
   * Используем defer: true чтобы предотвратить каскадные обновления
   */
  createEffect(
    on(
      draftId,
      (id: string) => {
        if (!id) {
          redirect('/edit')
          return
        }

        const parsedId = Number.parseInt(id)
        const draftsArray = drafts()

        if (!draftsArray || !Array.isArray(draftsArray)) return

        const requestedDraft = draftsArray.find((draft: Draft) => draft.id === parsedId)

        if (requestedDraft) {
          console.log(`[EditSettingsRoute] Setting current draft: ${requestedDraft.id}`)
          setCurrentDraft(requestedDraft)
        } else {
          console.warn(`[EditSettingsRoute] Draft with id=${parsedId} not found`)
          redirect('/edit')
        }
      },
      { defer: true } // Откладываем выполнение эффекта, чтобы избежать циклических обновлений
    )
  )

  // Мемоизируем заголовок страницы
  const pageTitle = createMemo(() => `${t('Discours')} :: ${t('Publication settings')}`)

  return (
    <PageLayout title={pageTitle()} hideFooter={true}>
      <AuthGuard>
        <EditSettingsView />
      </AuthGuard>
    </PageLayout>
  )
}
