import { clsx } from 'clsx'
import { Show, createEffect, createSignal, on } from 'solid-js'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { CommonResult, Reaction, ReactionBy, ReactionKind, Shout } from '~/graphql/schema/core.gen'
import { Icon } from '../_shared/Icon'
import { Popup } from '../_shared/Popup'
import { RATINGS_PER_PAGE, VotersList } from '../_shared/VotersList'

import { A } from '@solidjs/router'
import { useLocalize } from '~/context/localize'
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
  const [ratings, setRatings] = createSignal<Reaction[]>([])
  const [total, setTotal] = createSignal(
    props.comment ? props.comment.stat?.rating || 0 : props.shout?.stat?.rating || 0
  )
  // const [changed, setChanged] = createSignal(false)
  const [votersListVisible, setVotersListVisible] = createSignal(false)
  const [initialLoadDone, setInitialLoadDone] = createSignal(false)
  const toggleVotersList = (visible: boolean) => {
    // console.log('[RatingControl] voters list visibility changed to', visible)
    setVotersListVisible(visible)
  }

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
    // setChanged(true)
    return reactionToDelete
      ? await deleteShoutReaction(reactionToDelete.id)
      : { error: 'cant find reaction to delete' }
  }

  const currentRate = () => {
    if (props.shout) return props.shout.stat?.my_rate as ReactionKind | undefined
    if (props.comment) return props.comment.stat?.my_rate as ReactionKind | undefined
    return undefined
  }

  const handleRatingChange = async (isUpvote: boolean) => {
    const kind = isUpvote ? ReactionKind.Like : ReactionKind.Dislike
    console.log(`handleRatingChange clicked to ${kind}`)
    requireAuthentication(async () => {
      if (!props.shout) return

      const storedTotal = total()
      console.log('[RatingControl] myRate before', currentRate())
      if (!currentRate()) {
        // Оптимистичное обновление UI
        setTotal((t) => t + (isUpvote ? 1 : -1))
        console.log('[RatingControl] was not rated, creating reaction', kind)
        const reaction = await createShoutReaction({ reaction: { kind, shout: props.shout.id } })

        if (reaction) {
          console.warn('[RatingControl] created reaction: ', reaction)
          if (props.shout.stat) {
            props.shout.stat.my_rate = reaction.kind
          }
        } else {
          // Откатываем изменения если произошла ошибка
          console.error('[RatingControl] error creating reaction')
          setTotal(storedTotal)
        }
      } else if (currentRate() === kind) {
        return
      } else {
        // Оптимистичное обновление UI для смены рейтинга
        console.log('[RatingControl] removing reaction', currentRate() as ReactionKind)
        setTotal((t) => t + (isUpvote ? 1 : -1))
        const result: CommonResult | null = await removeReaction(currentRate() as ReactionKind)
        if (result?.error) {
          setTotal(storedTotal)
        } else if (props.shout.stat) {
          props.shout.stat.my_rate = undefined
        }
      }
      // setChanged(true)
    }, 'vote')
  }

  const handleRatingClick = async () => {
    if (!session()?.access_token) return

    // Если попап уже открыт, просто игнорируем клик
    if (votersListVisible()) return

    // Загружаем список только если он еще не был загружен
    if (!initialLoadDone()) {
      const by = {
        shout: props.shout?.slug,
        kinds: [ReactionKind.Like, ReactionKind.Dislike]
      } as ReactionBy
      if (props.comment) {
        by.reply_to = props.comment.id
      }
      const initialRatings = await loadReactionsBy({
        by,
        offset: 0,
        limit: RATINGS_PER_PAGE
      })

      if (initialRatings?.length) {
        setRatings(initialRatings)
        setInitialLoadDone(true)
      }
    }
    toggleVotersList(true)
  }

  // Обработчик закрытия попапа
  const toggleVotersListVisibility = (visible: boolean) => {
    if (!visible) {
      setRatings([])
      setInitialLoadDone(false)
    }
    toggleVotersList(visible)
  }

  const Trigger = () => (
    <div
      onClick={handleRatingClick}
      class={clsx(props.comment ? styles.commentRatingValue : styles.ratingValue, {
        [styles.commentRatingPositive]: props.comment && total() > 0,
        [styles.commentRatingNegative]: props.comment && total() < 0
      })}
    >
      {total()}
    </div>
  )

  const { t } = useLocalize()

  return (
    <div class={clsx(props.comment ? styles.commentRating : styles.shoutRating, props.class)}>
      <button
        onClick={() => handleRatingChange(false)}
        disabled={reactionsLoading()}
        class={clsx({
          [styles.commentRatingControl]: props.comment,
          [styles.commentRatingControlDown]: props.comment && currentRate() === ReactionKind.Dislike
        })}
      >
        <Show
          when={currentRate() !== ReactionKind.Dislike}
          fallback={<Icon name="rating-control-checked" />}
        >
          <Icon name="rating-control-less" />
        </Show>
      </button>

      <Popup trigger={<Trigger />} variant="tiny" onVisibilityChange={toggleVotersListVisibility}>
        <div class={styles.votersListContainer}>
          <Show
            when={session()?.access_token}
            fallback={
              <>
                <A class={styles.signInMessage} href="?m=auth&mode=login">
                  {t('Sign in')}
                </A>
                {t('to see who voted')}
              </>
            }
          >
            <VotersList reactions={ratings()} visible={votersListVisible()} />
          </Show>
        </div>
      </Popup>

      <button
        onClick={() => handleRatingChange(true)}
        disabled={reactionsLoading()}
        class={clsx({
          [styles.commentRatingControl]: props.comment,
          [styles.commentRatingControlUp]: props.comment && currentRate() === ReactionKind.Like
        })}
      >
        <Show when={currentRate() !== ReactionKind.Like} fallback={<Icon name="rating-control-checked" />}>
          <Icon name="rating-control-more" />
        </Show>
      </button>
    </div>
  )
}
