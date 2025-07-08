import { RouteDefinition, RouteSectionProps, useParams } from '@solidjs/router'
import { createResource, createSignal, onMount, Show } from 'solid-js'
import { NoHydration } from 'solid-js/web'
import { PageLayout } from '~/components/_shared/PageLayout'
import { InboxView } from '~/components/Views/InboxView'
import { useInbox } from '~/context/inbox'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { loadAuthorsAll } from '~/graphql/api/public'
import { Chat } from '~/graphql/generated'
import { Author } from '~/graphql/generated/graphql'

export const route = {
  load: async () => {
    const authorsAllFetcher = loadAuthorsAll()
    return {
      authors: await authorsAllFetcher()
    }
  }
} satisfies RouteDefinition

export const ChatPage = (props: RouteSectionProps<{ authors: Author[] }>) => {
  const { t } = useLocalize()
  const params = useParams()
  const { createChat, chats } = useInbox()
  const [chat, setChat] = createSignal<Chat>()
  const { session } = useSession()

  const [authors] = createResource(
    async () => {
      if (props.data.authors) {
        return props.data.authors
      }
      const authorsAllFetcher = loadAuthorsAll()
      return await authorsAllFetcher()
    },
    {
      initialValue: props.data.authors
    }
  )

  onMount(async () => {
    if (params.id.includes('-')) {
      // real chat id contains -
      setChat((_prev: Chat) => chats().find((x: Chat) => x.id === params.id))
    } else {
      try {
        // handle if params.id is an author's id
        const me = session()?.author.id as number
        const author = Number.parseInt(params.chat)
        const result = await createChat([author, me], '')
        result.chat && setChat(result.chat)
      } catch (e) {
        console.warn(e)
      }
    }
  })

  return (
    <PageLayout hideFooter={true} title={t('Inbox')}>
      <NoHydration>
        <Show when={!authors.loading && !authors.error}>
          <InboxView authors={authors() || []} chat={chat()} />
        </Show>
      </NoHydration>
    </PageLayout>
  )
}
