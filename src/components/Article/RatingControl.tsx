import { clsx } from 'clsx'
import { Show, createEffect, createSignal, on } from 'solid-js'
import { LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { Reaction, ReactionKind, Shout } from '~/graphql/schema/core.gen'
import { Icon } from '../_shared/Icon'
import { RATINGS_PER_PAGE, VotersList } from '../_shared/VotersList'

import styles from './RatingControl.module.scss'

interface Props {
  shout?: Shout
  comment?: Reaction
  class?: string
}

export const RatingControl = (props: Props) => {
  const { requireAuthentication } = useSession()
  const { createShoutReaction, deleteShoutReaction, loadReactionsBy, reactionsLoading } = useReactions()

  const [total, setTotal] = createSignal(props.comment?.stat?.rating || props.shout?.stat?.rating || 0)
  const [myRate, setMyRate] = createSignal<ReactionKind | null>(
    props.comment?.stat?.my_rate || props.shout?.stat?.my_rate || null
  )
  const [ratings, setRatings] = createSignal<Reaction[]>([])
  const [isPopupOpen, _setIsPopupOpen] = createSignal(false)
  const [hasMore, setHasMore] = createSignal(true)
  const [_isLoadingMore, setIsLoadingMore] = createSignal(false)

  createEffect(
    on(
      [() => props.shout?.stat?.rating as number, () => props.shout?.stat?.my_rate as ReactionKind],
      ([rating, myrate]) => {
        rating && setTotal(rating)
        myrate && setMyRate(myrate)
      }
    )
  )

  const loadVoters = async (isLoadMore = false) => {
    if (!isLoadMore && ratings().length > 0) return
    if (!hasMore()) return

    setIsLoadingMore(true)
    try {
      const result = await loadReactionsBy({
        by: {
          shout: props.shout?.slug,
          kinds: [ReactionKind.Like, ReactionKind.Dislike]
        },
        offset: ratings().length,
        limit: RATINGS_PER_PAGE
      })

      if (result) {
        setRatings((prev) => [...prev, ...result])
        setHasMore(result.length === RATINGS_PER_PAGE)
      }
    } finally {
      setIsLoadingMore(false)
    }
  }

  createEffect(on(isPopupOpen, (x: boolean) => x && loadVoters()))

  const handleRatingChange = async (isUpvote: boolean) => {
    const kind = isUpvote ? ReactionKind.Like : ReactionKind.Dislike

    requireAuthentication(async () => {
      if (!props.shout) return

      const currentRate = myRate()
      const storedTotal = total()

      if (!currentRate) {
        setTotal((t) => t + (isUpvote ? 1 : -1))
        setMyRate(kind)

        const result = await createShoutReaction({
          reaction: { kind, shout: props.shout.id }
        })

        if (!result) {
          setTotal(storedTotal)
          setMyRate(null)
        }
      } else if (currentRate === kind) {
        return
      } else {
        setTotal((t) => t + (isUpvote ? 1 : -1))
        setMyRate(null)

        const result = await deleteShoutReaction(ratings().find((r) => r.kind === currentRate)?.id || 0)

        if (result?.error) {
          setTotal(storedTotal)
          setMyRate(currentRate)
        }
      }
    }, 'vote')
  }

  return (
    <div class={clsx(styles.shoutRating, props.class)}>
      <button
        onClick={() => handleRatingChange(false)}
        disabled={reactionsLoading()}
        class={styles.ratingControl}
      >
        <Show when={myRate() !== ReactionKind.Dislike} fallback={<Icon name="rating-control-checked" />}>
          <Icon name="rating-control-less" />
        </Show>
      </button>

      <LoadMoreWrapper
        pageSize={RATINGS_PER_PAGE}
        loadFunction={async (offset) => {
          const result = await loadReactionsBy({
            by: {
              shout: props.shout?.slug,
              kinds: [ReactionKind.Like, ReactionKind.Dislike]
            },
            offset,
            limit: RATINGS_PER_PAGE
          })
          return result || []
        }}
      >
        <VotersList reactions={ratings()} />
      </LoadMoreWrapper>

      <button
        onClick={() => handleRatingChange(true)}
        disabled={reactionsLoading()}
        class={styles.ratingControl}
      >
        <Show when={myRate() !== ReactionKind.Like} fallback={<Icon name="rating-control-checked" />}>
          <Icon name="rating-control-more" />
        </Show>
      </button>
    </div>
  )
}
