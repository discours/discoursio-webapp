import { clsx } from 'clsx'
import { For, Show, createMemo, createSignal, onMount } from 'solid-js'

import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { Author, Reaction, ReactionInput, ReactionKind, ReactionSort } from '~/graphql/schema/core.gen'
import { SortFunction } from '~/types/common'
import { byCreated, byStat } from '~/utils/sort'
import { MiniEditor } from '../Editor/MiniEditor'
import { Button } from '../_shared/Button'
import { Loading } from '../_shared/Loading'
import { ShowIfAuthenticated } from '../_shared/ShowIfAuthenticated'
import { Comment } from './Comment'

import styles from './Article.module.scss'

type Props = {
  articleAuthors: Author[]
  shoutSlug: string
  shoutId: number
}

export const CommentsTree = (props: Props) => {
  const { session } = useSession()
  const { t } = useLocalize()
  const [commentsOrder, setCommentsOrder] = createSignal<ReactionSort>(ReactionSort.Newest)
  const [onlyNew, setOnlyNew] = createSignal(false)
  const [newReactions, setNewReactions] = createSignal<Reaction[]>([])
  const [clickedReplyId, setClickedReplyId] = createSignal<number>()
  const { reactionEntities, createShoutReaction, loadReactionsBy } = useReactions()

  const comments = createMemo(() =>
    Object.values(reactionEntities()).filter((reaction) => reaction.kind === 'COMMENT')
  )

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

  const CommentsTreeHeader = () => (
    <div class={styles.commentsHeaderWrapper}>
      <h2 class={styles.commentsHeader}>
        {t('Comments')} {comments().length.toString() || ''}
        <Show when={newReactions().length > 0}>
          <span class={styles.newReactions}>{` +${newReactions().length}`}</span>
        </Show>
      </h2>
      <Show when={comments().length > 0}>
        <ul class={clsx(styles.commentsViewSwitcher, 'view-switcher')}>
          <Show when={newReactions().length > 0}>
            <li classList={{ 'view-switcher__item--selected': onlyNew() }}>
              <Button variant="light" value={t('New only')} onClick={() => setOnlyNew(!onlyNew())} />
            </li>
          </Show>
          <li classList={{ 'view-switcher__item--selected': commentsOrder() === ReactionSort.Newest }}>
            <Button
              variant="light"
              value={t('By time')}
              onClick={() => {
                setCommentsOrder(ReactionSort.Newest)
              }}
            />
          </li>
          <li classList={{ 'view-switcher__item--selected': commentsOrder() === ReactionSort.Like }}>
            <Button
              variant="light"
              value={t('By rating')}
              onClick={() => {
                setCommentsOrder(ReactionSort.Like)
              }}
            />
          </li>
        </ul>
      </Show>
    </div>
  )

  const CommentsTreeItems = (props: Props) => (
    <ul class={styles.comments}>
      <For each={sortedComments().filter((r) => !r.reply_to)}>
        {(reaction) => (
          <Comment
            sortedComments={sortedComments()}
            isArticleAuthor={Boolean(props.articleAuthors.some((a) => a?.id === reaction.created_by.id))}
            comment={reaction}
            clickedReply={(id) => setClickedReplyId(id)}
            clickedReplyId={clickedReplyId()}
            lastSeen={shoutLastSeen()}
          />
        )}
      </For>
    </ul>
  )

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

  return (
    <Show when={!isLoading()} fallback={<Loading />}>
      <CommentsTreeHeader />

      <CommentsTreeItems {...props} />

      <ShowIfAuthenticated fallback={<FallbackMessage />}>
        <MiniEditor placeholder={t('Write a comment...')} onSubmit={handleSubmitComment} />
        <Show when={posting()}>
          <Loading />
        </Show>
      </ShowIfAuthenticated>
    </Show>
  )
}
