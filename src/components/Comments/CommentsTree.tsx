import { ErrorBoundary, For, Show, createMemo, createResource, createSignal, onMount } from 'solid-js'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { Author, Reaction, ReactionInput, ReactionKind, ReactionSort } from '~/graphql/schema/core.gen'
import { SortFunction } from '~/types/common'
import { byCreated, byStat } from '~/utils/sort'
import { MiniEditor } from '../Editor/MiniEditor'
import { Loading } from '../_shared/Loading'
import { ShowIfAuthenticated } from '../_shared/ShowIfAuthenticated'
import { Comment as CommentCard } from './Comment'
import { CommentsHeader } from './CommentsHeader'

import styles from '../Article/Article.module.scss'

type Props = {
  articleAuthors: Author[]
  shoutSlug: string
  shoutId: number
}

interface ErrorBoundaryError extends Error {
  message: string
}

export const CommentsTree = (props: Props) => {
  const { session } = useSession()
  const { t } = useLocalize()
  const [onlyNew, setOnlyNew] = createSignal(false)
  const [clickedReplyId, setClickedReplyId] = createSignal<number>()
  const { reactionEntities, createShoutReaction, loadReactionsBy } = useReactions()

  const [newReactions, setNewReactions] = createSignal<Reaction[]>([])
  const [commentsOrder, setCommentsOrder] = createSignal<ReactionSort>(ReactionSort.Newest)

  const comments = createMemo(() =>
    Object.values(reactionEntities()).filter((reaction) => reaction.kind === 'COMMENT')
  )

  const toggleNewOnly = () => setOnlyNew(!onlyNew())

  const sortedComments = createMemo(() => {
    let newSortedComments = [...comments()]
    newSortedComments = newSortedComments.sort(byCreated)

    if (onlyNew()) {
      return newReactions().sort(byCreated).reverse()
    }

    if (commentsOrder() === ReactionSort.Like) {
      newSortedComments = newSortedComments.sort(byStat('rating') as SortFunction<Reaction>)
    }
    return newSortedComments
  })
  const { seen } = useFeed()
  const shoutLastSeen = createMemo(() => seen()[props.shoutSlug] ?? 0)
  const [isLoading, setIsLoading] = createSignal(true)

  onMount(async () => {
    setIsLoading(true)
    const currentDate = new Date()
    const setCookie = () => localStorage?.setItem(`${props.shoutSlug}`, `${currentDate}`)
    if (!shoutLastSeen()) {
      setCookie()
    } else if (currentDate.getTime() > shoutLastSeen()) {
      const newComments = comments().filter((c) => {
        if (
          (session()?.user?.app_data?.profile?.id && c.reply_to) ||
          c.created_by.id === session()?.user?.app_data?.profile?.id
        ) {
          return
        }
        return (c.updated_at || c.created_at) > shoutLastSeen()
      })
      setNewReactions(newComments)
      setCookie()
    }
    await loadReactionsBy({ by: { shout: props.shoutSlug } })
    setIsLoading(false)
  })

  const [posting, setPosting] = createSignal(false)
  const handleSubmitComment = async (value: string) => {
    setPosting(true)
    try {
      const createdReaction = await createShoutReaction({
        reaction: {
          kind: ReactionKind.Comment,
          body: value,
          shout: props.shoutId
        } as ReactionInput
      })
      // await loadReactionsBy({ by: { shout: props.shoutSlug, kinds: [ReactionKind.Comment] } })
      if (createdReaction) {
        setTimeout(() => setNewReactions([createdReaction, ...newReactions()]), 100)
        console.debug('[handleCreate reaction]:', createdReaction)
      }
    } catch (error) {
      console.error('[handleCreate reaction]:', error)
    }
    setPosting(false)
  }

  const FallbackMessage = () => (
    <div class={styles.signInMessage}>
      {t('To write a comment, you must')}{' '}
      <a href="?m=auth&mode=register" class={styles.link}>
        {t('sign up')}
      </a>{' '}
      {t('or')}{' '}
      <a href="?m=auth&mode=login" class={styles.link}>
        {t('sign in')}
      </a>
    </div>
  )

  const [commentsResource, { refetch }] = createResource<Reaction[], string>(
    () => props.shoutSlug,
    async (slug: string) => {
      const response = await loadReactionsBy({
        by: {
          shout: slug,
          kinds: [ReactionKind.Comment]
        }
      })
      return response || []
    }
  )

  const CommentsTreeItems = (props: Props) => (
    <ul class={styles.comments}>
      <For each={sortedComments().filter((r) => !r.reply_to)}>
        {(reaction) => (
          <CommentCard
            sortedComments={sortedComments()}
            isArticleAuthor={Boolean(props.articleAuthors.some((a) => a?.id === reaction.created_by.id))}
            comment={reaction}
            clickedReply={(id: number) => setClickedReplyId(id)}
            clickedReplyId={clickedReplyId()}
            lastSeen={shoutLastSeen()}
          />
        )}
      </For>
    </ul>
  )

  return (
    <ErrorBoundary
      fallback={(err: ErrorBoundaryError) => (
        <div class="error">
          <p>{err.message}</p>
          <button onClick={() => refetch()}>{t('Try again')}</button>
        </div>
      )}
    >
      <div>
        <Show when={!isLoading()} fallback={<Loading />}>
          <CommentsHeader
            comments={comments()}
            newComments={newReactions()}
            order={commentsOrder()}
            setOrder={setCommentsOrder}
            toggleNewOnly={toggleNewOnly}
            onlyNew={onlyNew()}
          />

          <Show when={!commentsResource.loading} fallback={<Loading />}>
            <Show when={commentsResource()} fallback={<div>{t('No comments yet')}</div>}>
              <CommentsTreeItems {...props} />
            </Show>
          </Show>

          <ShowIfAuthenticated fallback={<FallbackMessage />}>
            <MiniEditor placeholder={t('Write a comment...')} onSubmit={handleSubmitComment} />
            <Show when={posting()}>
              <Loading />
            </Show>
          </ShowIfAuthenticated>
        </Show>
      </div>
    </ErrorBoundary>
  )
}
