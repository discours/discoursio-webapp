import { For, Show, onMount } from 'solid-js'
import { DraftComponent } from '~/components/Draft'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { Draft } from '~/graphql/schema/core.gen'

export const DraftsView = (_props: { drafts?: Draft[] }) => {
  const { requireAuthentication } = useSession()
  onMount(() => requireAuthentication(loadDrafts, 'edit'))
  const { t } = useLocalize()
  const { publishDraft, deleteDraft, drafts, loadDrafts } = useDrafts()
  const handleDraftDelete = async (d: Draft) => await deleteDraft(d.id)
  return (
    <div>
      <div class="wide-container">
        <div class="row offset-md-5">
          <h2>{t('Drafts')}</h2>
        </div>
        <Show when={drafts()} fallback={t('No drafts')}>
          <div class="row">
            <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
              <For each={drafts()}>
                {(draft: Draft) => (
                  <DraftComponent
                    draft={draft as Draft}
                    onDelete={() => handleDraftDelete(draft)}
                    onPublish={() => publishDraft(draft.id)}
                  />
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
