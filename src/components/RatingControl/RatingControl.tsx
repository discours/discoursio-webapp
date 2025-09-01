import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createSignal, on, Show } from 'solid-js'
import { toast } from 'solid-toast'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { Reaction, ReactionBy, ReactionKind, Shout } from '~/graphql/generated/graphql'
import { Icon } from '../_shared/Icon'
import { LoadMoreItems, LoadMoreWrapper } from '../_shared/LoadMoreWrapper'
import { Popup } from '../_shared/Popup'
import styles from './RatingControl.module.scss'
import { RATINGS_PER_PAGE, VotersList } from './VotersList'

interface Props {
  shout?: Shout
  comment?: Reaction
  class?: string
  myRate: ReactionKind | undefined
}

export const RatingControl = (props: Props) => {
  const { requireAuthentication, session } = useSession()
  const { reactionsByShout, createShoutReaction, deleteShoutReaction, loadReactionsBy, reactionsLoading } =
    useReactions()
  const [ratings, setRatings] = createSignal<Reaction[]>([])
  const [total, setTotal] = createSignal(
    props.comment ? props.comment.stat?.rating || 0 : props.shout?.stat?.rating || 0
  )
  const [currentRate, setCurrentRate] = createSignal<ReactionKind | undefined>(props.myRate)
  const [votersListVisible, setVotersListVisible] = createSignal(false)
  const [initialLoadDone, setInitialLoadDone] = createSignal(false)

  const commentRatingFilter = (r: Reaction) =>
    (r.kind === ReactionKind.Like || r.kind === ReactionKind.Dislike) && r.reply_to === props.comment?.id
  const shoutRatingFilter = (r: Reaction) =>
    (r.kind === ReactionKind.Like || r.kind === ReactionKind.Dislike) && !r.reply_to
  const mineFilter = (r: Reaction) => r.created_by.slug === session()?.author?.slug

  createEffect(on(() => props.myRate, setCurrentRate))

  createEffect(
    on(
      [() => reactionsByShout()[props.shout?.id || 0], () => session()?.author],
      ([rrr, author]) => {
        if (rrr !== ratings() && rrr) {
          // Удаляем дубликаты по id
          const uniqueReactions = Array.from(new Map(rrr.map((r) => [r.id, r])).values())
          const shoutRatings = uniqueReactions.filter(props.comment ? commentRatingFilter : shoutRatingFilter)
          // console.log('[RatingControl] filtered ratings:', shoutRatings)
          // console.debug('[RatingControl] profile:', profile)
          if (author) {
            const mr = shoutRatings.find((r) => r.created_by.slug === author.slug)
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
    // Блокируем повторные клики во время обработки
    if (reactionsLoading()) {
      console.log('[RatingControl] Already processing, ignoring click')
      return
    }

    if (ratings().length === 0) await loadRatings()
    const kind = isUpvote ? ReactionKind.Like : ReactionKind.Dislike
    requireAuthentication(async () => {
      if (!(props.shout || props.comment)) {
        console.error('[RatingControl] No shout or comment provided')
        return
      }

      try {
        const storedTotal = total()
        const storedRate = currentRate()
        const currentRatings = ratings()

        // Получаем корректный shout.id
        const shoutId = props.shout?.id || props.comment?.shout?.id

        if (!shoutId) {
          console.error('[RatingControl] Invalid shout id:', {
            shout: props.shout,
            comment: props.comment
          })
          toast.error(t('Cannot vote: invalid article'))
          return
        }

        // 🔧 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: убеждаемся что shoutId это число
        if (typeof shoutId !== 'number' || shoutId <= 0) {
          console.error('[RatingControl] Invalid shout id type:', typeof shoutId, shoutId)
          toast.error(t('Cannot vote: invalid article ID'))
          return
        }

        // Подготавливаем базовые данные для реакции
        const baseReactionData = {
          kind,
          shout: shoutId,
          reply_to: props.comment?.id
        }

        console.log('[RatingControl] Preparing reaction:', {
          baseReactionData,
          currentRate: storedRate,
          isUpvote,
          currentRatings
        })

        // Если нет текущей оценки - создаем новую
        if (!storedRate) {
          setTotal((t) => t + (isUpvote ? 1 : -1))

          const reaction = await createShoutReaction({ reaction: baseReactionData })
          console.log('[RatingControl] Create reaction response:', reaction)

          if (reaction) {
            setRatings((prev) => [...prev, reaction])
            setCurrentRate(kind)
          } else {
            console.error('[RatingControl] Failed to create reaction')
            setTotal(storedTotal)
          }
          return
        }

        // Если нажали на ту же кнопку - игнорируем клик (голос уже установлен)
        if (storedRate === kind) {
          console.log('[RatingControl] Same rate clicked, ignoring (vote already set)')
          return
        }
        // Ищем существующую реакцию для удаления
        const reactionToDelete = currentRatings.find(
          (r) =>
            r.kind === storedRate && mineFilter(r) && (props.comment ? commentRatingFilter(r) : shoutRatingFilter(r))
        )

        if (reactionToDelete) {
          // Отменяем текущий голос - возвращаем к нейтральному состоянию
          setTotal((t) => t + (storedRate === ReactionKind.Like ? -1 : 1))
          const deleteResult = await deleteShoutReaction(reactionToDelete.id)

          if (deleteResult?.error) {
            console.error('[RatingControl] Error removing reaction:', deleteResult.error)
            setTotal(storedTotal)
            setCurrentRate(storedRate)
            return
          }

          // Удаляем старую реакцию из списка и устанавливаем нейтральное состояние
          setRatings((prev) => prev.filter((r) => r.id !== reactionToDelete.id))
          setCurrentRate(undefined) // НЕЙТРАЛЬНОЕ СОСТОЯНИЕ

          console.log('[RatingControl] Vote cancelled, now in neutral state')
        } else {
          console.error('[RatingControl] Could not find reaction to delete', currentRatings)
          // Если не нашли реакцию, просто устанавливаем нейтральное состояние
          setCurrentRate(undefined)
        }
      } catch (error) {
        console.error('[RatingControl] Error in handleRatingChange:', error)
        setTotal(total()) // Восстанавливаем предыдущее значение
        setCurrentRate(currentRate()) // Восстанавливаем предыдущую оценку
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
    if (!session()?.token) return

    // Если попап уже открыт, просто игнорируем клик
    if (votersListVisible()) return

    await loadRatings()
    setVotersListVisible(true)
  }

  // Обработчик закрытия попапа
  const toggleVotersListVisibility = (visible: boolean) => {
    if (!visible) {
      setInitialLoadDone(false)
    }
    setVotersListVisible(visible)
  }
  const { t } = useLocalize()

  const loadMoreRatings = async () => {
    const moreRatings = await loadReactionsBy({
      by: { shout: props.shout?.slug },
      offset: ratings().length,
      limit: RATINGS_PER_PAGE
    })
    return moreRatings as LoadMoreItems
  }

  return (
    <div class={clsx(styles.ratingControl, props.class)}>
      <button onClick={() => handleRatingChange(false)} disabled={reactionsLoading()}>
        <Show when={currentRate() === ReactionKind.Dislike} fallback={<Icon name="rating-control-less" />}>
          <Icon name="rating-control-checked" />
        </Show>
      </button>

      <Popup
        variant="tiny"
        onVisibilityChange={toggleVotersListVisibility}
        trigger={
          <div onClick={handleRatingClick} class={clsx(styles.ratingValue)}>
            {total()}
          </div>
        }
      >
        <div class={styles.votersListContainer}>
          <Show
            when={session()?.token}
            fallback={
              <>
                <A class={styles.signInMessage} href="?m=auth&mode=login">
                  {t('Sign in')}
                </A>
                {t('to see who voted')}
              </>
            }
          >
            <LoadMoreWrapper loadFunction={loadMoreRatings} loadMoreText={'...'} pageSize={RATINGS_PER_PAGE}>
              <VotersList reactions={ratings()} visible={votersListVisible()} />
            </LoadMoreWrapper>
          </Show>
        </div>
      </Popup>

      <button onClick={() => handleRatingChange(true)} disabled={reactionsLoading()}>
        <Show when={currentRate() === ReactionKind.Like} fallback={<Icon name="rating-control-more" />}>
          <Icon name="rating-control-checked" />
        </Show>
      </button>
    </div>
  )
}
