import { clsx } from 'clsx'
import { Show, createEffect, createSignal, on } from 'solid-js'
import { debounce } from 'throttle-debounce'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { CommonResult, Reaction, ReactionKind, Shout } from '~/graphql/schema/core.gen'
import { Icon } from '../_shared/Icon'
import { Loading } from '../_shared/Loading'
import { Popup } from '../_shared/Popup'
import { RATINGS_PER_PAGE, VotersList } from '../_shared/VotersList'

import styles from './RatingControl.module.scss'

interface Props {
  shout?: Shout
  comment?: Reaction
  class?: string
}

export const RatingControl = (props: Props) => {
  const { requireAuthentication, session } = useSession()
  const { reactionsByShout, createShoutReaction, deleteShoutReaction, loadReactionsBy, reactionsLoading } =
    useReactions()
  const [myRate, setMyRate] = createSignal<ReactionKind | null>(null)
  const [ratings, setRatings] = createSignal<Reaction[]>([])
  const [total, setTotal] = createSignal(props.shout?.stat?.rating || 0)

  const commentRatingFilter = (r: Reaction) =>
    (r.kind === ReactionKind.Like || r.kind === ReactionKind.Dislike) && r.reply_to === props.comment?.id
  const shoutRatingFilter = (r: Reaction) =>
    (r.kind === ReactionKind.Like || r.kind === ReactionKind.Dislike) && !r.reply_to
  const mineFilter = (r: Reaction) => r.created_by.slug === session()?.user?.app_data?.profile?.slug

  createEffect(
    on(
      [() => reactionsByShout()[props.shout?.id || 0], () => session()?.user?.app_data?.profile],
      ([rrr, profile]) => {
        if (rrr) {
          const shoutRatings = rrr.filter(props.comment ? commentRatingFilter : shoutRatingFilter)
          profile && setRatings((_rrr) => shoutRatings)

          const my = shoutRatings.find((r) => r.created_by.slug === profile?.slug)
          setMyRate(my ? my.kind : null)
          my && console.log('[RatingControl] myRate after', my?.kind)
        }
      },
      {}
    )
  )

  const removeReaction = async (reactionKind: ReactionKind) => {
    console.log('[RatingControl] ratings before', ratings())
    const reactionToDelete = ratings().find(
      (r) => r.kind === reactionKind && mineFilter(r) && shoutRatingFilter(r)
    )
    return reactionToDelete
      ? await deleteShoutReaction(reactionToDelete.id)
      : { error: 'cant find reaction to delete' }
  }

  const debouncedLoadReactions = debounce(2000, () => {
    loadReactionsBy({
      by: { shout: props.shout?.slug, kinds: [ReactionKind.Like, ReactionKind.Dislike] },
      offset: 0,
      limit: RATINGS_PER_PAGE
    })
  })

  const handleRatingChange = async (isUpvote: boolean) => {
    const kind = isUpvote ? ReactionKind.Like : ReactionKind.Dislike
    console.log(`handleRatingChange clicked to ${kind}`)
    requireAuthentication(async () => {
      if (!props.shout) return

      const storedTotal = total()
      console.log('[RatingControl] myRate before', myRate())
      if (!myRate()) {
        setTotal((t) => t + (isUpvote ? 1 : -1))
        console.log('[RatingControl] was not rated, creating reaction', kind)
        const reaction = await createShoutReaction({ reaction: { kind, shout: props.shout.id } })

        if (reaction) {
          console.warn('[RatingControl] created reaction: ', reaction)
          setMyRate(reaction.kind)
        } else {
          console.error('[RatingControl] error creating reaction')
          setTotal(storedTotal)
        }
      } else if (myRate() === kind) {
        return
      } else {
        console.log('[RatingControl] removing reaction', myRate() as ReactionKind)
        setTotal((t) => t + (isUpvote ? 1 : -1))
        const result: CommonResult | null = await removeReaction(myRate() as ReactionKind)
        if (result?.error) {
          console.error('[RatingControl] error removing reaction:', result?.error)
          setTotal(storedTotal)
        } else {
          setRatings((rrr: Reaction[]) => rrr?.filter((r: Reaction) => r.id !== result?.reaction?.id))
          setMyRate(null)
        }
      }

      debouncedLoadReactions()
    }, 'vote')
  }
  const Trigger = () =>
    props.comment ? (
      <div
        class={clsx(styles.commentRatingValue, {
          [styles.commentRatingPositive]: (props.comment?.stat?.rating || 0) > 0,
          [styles.commentRatingNegative]: (props.comment?.stat?.rating || 0) < 0
        })}
      >
        {props.comment?.stat?.rating || 0}
      </div>
    ) : (
      <span class={styles.ratingValue}>{total()}</span>
    )

  return (
    <div class={clsx(props.comment ? styles.commentRating : styles.shoutRating, props.class)}>
      <button
        onClick={() => handleRatingChange(false)}
        disabled={reactionsLoading()}
        class={clsx({
          [styles.commentRatingControl]: props.comment,
          [styles.commentRatingControlDown]: props.comment && myRate() === ReactionKind.Dislike
        })}
      >
        <Show when={myRate() !== ReactionKind.Dislike} fallback={<Icon name="rating-control-checked" />}>
          <Icon name="rating-control-less" />
        </Show>
      </button>

      <Popup trigger={<Trigger />} variant="tiny">
        <Show when={!reactionsLoading()} fallback={<Loading size="tiny" />}>
          <VotersList reactions={ratings()} />
        </Show>
      </Popup>

      <button
        onClick={() => handleRatingChange(true)}
        disabled={reactionsLoading()}
        class={clsx({
          [styles.commentRatingControl]: props.comment,
          [styles.commentRatingControlUp]: props.comment && myRate() === ReactionKind.Like
        })}
      >
        <Show when={myRate() !== ReactionKind.Like} fallback={<Icon name="rating-control-checked" />}>
          <Icon name="rating-control-more" />
        </Show>
      </button>
    </div>
  )
}
