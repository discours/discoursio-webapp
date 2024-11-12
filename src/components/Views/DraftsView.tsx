import { useNavigate } from '@solidjs/router'
import { Client } from '@urql/core'
import { For, Show, createSignal, onMount } from 'solid-js'
import { Draft } from '~/components/Draft'
import { useEditorContext } from '~/context/editor'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import getDraftsQuery from '~/graphql/query/core/articles-load-drafts'
import { Shout } from '~/graphql/schema/core.gen'

const fetchDrafts = async (client: Client) => {
  const resp = await client?.query(getDraftsQuery, {}).toPromise()
  const result = resp?.data?.get_shouts_drafts || []
  if (resp.error || result.error) console.error(resp.error || result.error)
  return result.shouts as Shout[]
}

export const DraftsView = (props: { drafts?: Shout[] }) => {
  const { client, requireAuthentication } = useSession()
  const navigate = useNavigate()
  const { publishShoutById, deleteShout } = useEditorContext()
  const [drafts, setDrafts] = createSignal<Shout[]>(props.drafts || [])

  const handleDraftDelete = async (shout: Shout) => {
    const success = await deleteShout(shout.id)
    if (success) {
      setDrafts((ddd) => ddd.filter((d) => d.id !== shout.id))
    }
  }

  const handleDraftPublish = (shout: Shout) => {
    publishShoutById(shout.id)
    setTimeout(() => navigate('/feed'), 2000)
  }

  onMount(() => {
    requireAuthentication(async () => {
      const result = await fetchDrafts(client() as Client)
      // console.debug('fetchDrafts result: ', result)
      if (result) {
        setDrafts(result as Shout[])
      }
    }, 'edit')
  })

  const { t } = useLocalize()

  return (
    <div>
      <div class="wide-container">
        <div class="row offset-md-5">
          <h2>{t('Drafts')}</h2>
        </div>
        <Show when={drafts()} fallback={t('No drafts')}>
          {(ddd) => (
            <div class="row">
              <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
                <For each={ddd()}>
                  {(draft) => (
                    <Draft shout={draft} onDelete={handleDraftDelete} onPublish={handleDraftPublish} />
                  )}
                </For>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
