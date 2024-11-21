import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show, createEffect, createSignal, on } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { Reaction, ReactionBy, ReactionKind, Shout } from '~/graphql/schema/core.gen'
import { Icon } from '../_shared/Icon'
import { Popup } from '../_shared/Popup'
import { RATINGS_PER_PAGE, VotersList } from './VotersList'

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
  const [currentRate, setCurrentRate] = createSignal<ReactionKind | undefined>()
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
          // Удаляем дубликаты по id
          const uniqueReactions = Array.from(new Map(rrr.map((r) => [r.id, r])).values())
          const shoutRatings = uniqueReactions.filter(
            props.comment ? commentRatingFilter : shoutRatingFilter
          )
          console.log('[RatingControl] filtered ratings:', shoutRatings)
          // console.debug('[RatingControl] profile:', profile)
          if (profile) {
            const mr = shoutRatings.find((r) => r.created_by.slug === profile.slug)
            if (mr) {
              setCurrentRate(mr.kind)
            }
            setRatings(shoutRatings) // Убираем стрелочную функцию, она здесь не нужна
          }
        }
      },
      { defer: true }
    )
  )

  const handleRatingChange = async (isUpvote: boolean) => {
    if (ratings().length === 0) await loadRatings()
    const kind = isUpvote ? ReactionKind.Like : ReactionKind.Dislike
    requireAuthentication(async () => {
      if (!(props.shout || props.comment)) return
      const storedTotal = total()
      const storedRate = currentRate()

      // Сохраняем текущие рейтинги перед изменением
      const currentRatings = ratings()

      if (!storedRate && props.shout) {
        // Оптимистичное обновление UI
        setTotal((t) => t + (isUpvote ? 1 : -1))
        const reaction = await createShoutReaction({ reaction: { kind, shout: props.shout.id } })

        if (reaction) {
          console.warn('[RatingControl] created reaction: ', reaction)
          // Добавляем новую реакцию в список
          setRatings((prev) => [...prev, reaction])
          setCurrentRate(kind)
        } else {
          // Откатываем изменения если произошла ошибка
          console.error('[RatingControl] error creating reaction')
          setTotal(storedTotal)
        }
      } else if (storedRate === kind) {
        console.log('[RatingControl] Same rate clicked, ignoring')
        return
      } else {
        console.log('[RatingControl] Changing existing rate', {
          from: storedRate,
          to: kind,
          currentRatings // Добавляем лог текущих рейтингов
        })

        // Используем сохраненные рейтинги для поиска
        const reactionToDelete = currentRatings.find(
          (r) =>
            r.kind === storedRate &&
            mineFilter(r) &&
            (props.comment ? commentRatingFilter(r) : shoutRatingFilter(r))
        )

        if (reactionToDelete) {
          setTotal((t) => t + (isUpvote ? 1 : -1))
          const result = await deleteShoutReaction(reactionToDelete.id)
          if (result?.error) {
            setTotal(storedTotal)
            setCurrentRate(storedRate)
            console.error(`[RatingControl] error removing reaction ${storedRate}`, result.error)
          } else {
            setRatings((prev) => prev.filter((r) => r.id !== reactionToDelete.id))
            setCurrentRate(undefined)
          }
        } else {
          console.error('[RatingControl] Could not find reaction to delete', currentRatings)
        }
      }
    }, 'vote')
  }

  const loadRatings = async () => {
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
  }

  const handleRatingClick = async () => {
    if (!session()?.access_token) return

    // Если попап уже открыт, просто игнорируем клик
    if (votersListVisible()) return

    await loadRatings()
    toggleVotersList(true)
  }

  // Обработчик закрытия попапа
  const toggleVotersListVisibility = (visible: boolean) => {
    if (!visible) {
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
        <Show when={currentRate() === ReactionKind.Dislike} fallback={<Icon name="rating-control-less" />}>
          <Icon name="rating-control-checked" />
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
        <Show when={currentRate() === ReactionKind.Like} fallback={<Icon name="rating-control-more" />}>
          <Icon name="rating-control-checked" />
        </Show>
      </button>
    </div>
  )
}
