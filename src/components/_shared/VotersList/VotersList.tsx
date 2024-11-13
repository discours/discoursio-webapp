import { clsx } from 'clsx'
import { For, Show, createEffect, createSignal, on } from 'solid-js'

import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { Reaction, ReactionBy, ReactionKind } from '~/graphql/schema/core.gen'
import { Userpic } from '../../Author/Userpic'

import { A } from '@solidjs/router'
import { useReactions } from '~/context/reactions'
import { byCreated } from '~/utils/sort'
import { LoadMoreWrapper } from '../LoadMoreWrapper'
import { Loading } from '../Loading'
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
  const [ratings, setRatings] = createSignal<Reaction[]>(props.reactions || [])

  createEffect(() => {
    if (props.reactions) {
      setRatings(props.reactions.sort(byCreated))
    }
  })

  createEffect(
    on(
      () => props.visible,
      (visible) => {
        if (visible) {
          setHiddenMoreButton(props.reactions.length < RATINGS_PER_PAGE)
        }
      }
    )
  )

  const loadMore = async (offset: number) => {
    if (reactionsLoading() || !props.reactions[0]?.shout?.slug) return []

    try {
      const newRatings = await loadReactionsBy({
        by: {
          shout: props.reactions[0].shout.slug,
          kinds: [ReactionKind.Like, ReactionKind.Dislike]
        } as ReactionBy,
        offset,
        limit: RATINGS_PER_PAGE
      })

      if (!newRatings?.length) {
        setHiddenMoreButton(true)
        return []
      }

      setHiddenMoreButton(newRatings.length < RATINGS_PER_PAGE)
      setRatings((prev) => {
        const combined = [...prev, ...newRatings]
        const unique = Array.from(new Map(combined.map((item) => [item.id, item])).values())
        return unique.sort(byCreated)
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
              when={ratings().length > 0}
              fallback={
                <li class={clsx(styles.item, styles.fallbackMessage)}>
                  <Show when={!session()?.access_token} fallback={t('No one rated yet')}>
                    <A href="?m=auth&mode=login">{t('Sign in')}</A>
                    {`, ${t('to see who rated')}`}
                  </Show>
                </li>
              }
            >
              <For each={ratings()}>
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
