import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, batch, createEffect, createMemo, createSignal } from 'solid-js'

import { Userpic } from '~/components/Author/Userpic'
import { LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { Loading } from '~/components/_shared/Loading'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { Reaction, ReactionBy, ReactionKind } from '~/graphql/schema/core.gen'
import { byCreated } from '~/utils/sort'

import styles from './VotersList.module.scss'

export type VotersListProps = {
  reactions: Reaction[]
  visible?: boolean
}

export const RATINGS_PER_PAGE = 10

export const VotersList = (props: VotersListProps) => {
  const { t } = useLocalize()
  const { session } = useSession()
  const { loadReactionsBy, reactionsLoading } = useReactions()
  const [hiddenMoreButton, setHiddenMoreButton] = createSignal(true)
  const [ratings, setRatings] = createSignal<Map<string, Reaction>>(new Map())

  const sortedReactions = createMemo(() => {
    if (!(props.reactions && props.visible)) return []
    return [...props.reactions].sort(byCreated)
  })

  const sortedRatings = createMemo(() => {
    return Array.from(ratings().values()).sort(byCreated)
  })

  createEffect(() => {
    const sorted = sortedReactions()
    if (sorted.length) {
      batch(() => {
        const newMap = new Map()
        sorted.forEach((item) => newMap.set(item.id, item))
        setRatings(newMap)
        setHiddenMoreButton(sorted.length < RATINGS_PER_PAGE)
      })
    }
  })

  const loadMore = async (offset: number) => {
    if (reactionsLoading() || !props.reactions[0]?.shout?.slug) return []

    try {
      const by = {
        shout: props.reactions[0].shout.slug,
        kinds: [ReactionKind.Like, ReactionKind.Dislike]
      } as ReactionBy
      if (props.reactions[0].reply_to) {
        by.reply_to = props.reactions[0].reply_to
      }
      const newRatings = await loadReactionsBy({
        by,
        offset,
        limit: RATINGS_PER_PAGE
      })

      if (!newRatings?.length) {
        setHiddenMoreButton(true)
        return []
      }

      batch(() => {
        setHiddenMoreButton(newRatings.length < RATINGS_PER_PAGE)
        setRatings((prev) => {
          const newMap = new Map(prev)
          newRatings.forEach((item) => newMap.set(item.id.toString(), item))
          return newMap
        })
      })

      return newRatings
    } catch (error) {
      console.error('Error loading more ratings:', error)
      return []
    }
  }

  return (
    <div class={styles.VotersList}>
      <LoadMoreWrapper
        loadFunction={loadMore}
        pageSize={RATINGS_PER_PAGE}
        size="S"
        loadMoreText={t('...more')}
        hidden={hiddenMoreButton()}
      >
        <ul class={clsx('nodash', styles.users)}>
          <Show
            when={!reactionsLoading()}
            fallback={
              <li class={styles.item}>
                <Loading size="tiny" />
              </li>
            }
          >
            <Show
              when={ratings().size > 0}
              fallback={
                <li class={clsx(styles.item, styles.fallbackMessage)}>
                  <Show when={!session()?.token} fallback={t('No one rated yet')}>
                    <A href="?m=auth&mode=login">{t('Sign in')}</A>
                    {`, ${t('to see who rated')}`}
                  </Show>
                </li>
              }
            >
              <For each={sortedRatings()}>
                {(reaction) => (
                  <li class={styles.item}>
                    <div class={styles.user}>
                      <Userpic
                        name={reaction.created_by.name || ''}
                        userpic={reaction.created_by.pic || ''}
                        class={styles.userpic}
                      />
                      <a href={`/@${reaction.created_by.slug}`}>{reaction.created_by.name || ''}</a>
                    </div>
                    {reaction.kind === ReactionKind.Like ? (
                      <div class={styles.commentRatingPositive}>+1</div>
                    ) : (
                      <div class={styles.commentRatingNegative}>&minus;1</div>
                    )}
                  </li>
                )}
              </For>
            </Show>
          </Show>
        </ul>
      </LoadMoreWrapper>
    </div>
  )
}
