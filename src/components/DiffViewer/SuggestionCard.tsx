import { createSignal, Show } from 'solid-js'
import { toast } from 'solid-sonner'
import { Icon } from '~/components/_shared/Icon'
import { RatingControl } from '~/components/RatingControl/RatingControl'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { MutationCreate_ReactionArgs, Reaction, ReactionInput, ReactionKind } from '~/graphql/generated/graphql'

import styles from './SuggestionCard.module.scss'

export interface SuggestionCardProps {
  reaction: Reaction
  isReply?: boolean
  onReply?: (reactionId: number) => void
  canModerate?: boolean
}

/**
 * Компонент карточки предложения/вопроса
 * Отображает содержимое реакции, информацию об авторе и элементы управления
 */
export const SuggestionCard = (props: SuggestionCardProps) => {
  const { session } = useSession()
  const { t, formatDate } = useLocalize()
  const { createShoutReaction } = useReactions()

  const [isExpanded, setIsExpanded] = createSignal(false)
  const [isProcessing, setIsProcessing] = createSignal(false)

  /**
   * Проверяет, может ли текущий пользователь модерировать реакцию
   */
  const canUserModerate = () => {
    return session()?.token && props.canModerate
  }

  /**
   * Создает модерационную реакцию (принятие/отклонение)
   */
  const createModeratorReaction = async (kind: ReactionKind) => {
    if (!canUserModerate()) {
      toast.error(t('Only author can moderate suggestions'))
      return
    }

    if (!props.reaction.shout?.id) {
      console.error('Missing shout ID in reaction')
      return
    }

    setIsProcessing(true)
    try {
      await createShoutReaction({
        reaction: {
          reply_to: props.reaction.id,
          shout: props.reaction.shout.id,
          kind,
          body: ''
        } as ReactionInput
      } as MutationCreate_ReactionArgs)

      toast.success(kind === ReactionKind.Accept ? t('Suggestion accepted') : t('Suggestion rejected'))
    } catch (error) {
      console.error('[SuggestionCard] Error moderating reaction:', error)
      toast.error(t('Failed to moderate suggestion'))
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Обработчик принятия предложения
   */
  const handleApprove = () => createModeratorReaction(ReactionKind.Accept)

  /**
   * Обработчик отклонения предложения
   */
  const handleReject = () => createModeratorReaction(ReactionKind.Reject)

  /**
   * Проверяет, нужно ли показывать кнопку "Развернуть"
   */
  const shouldShowExpand = () => {
    return props.reaction.body && props.reaction.body.length > 150 && !isExpanded()
  }

  /**
   * Возвращает статус реакции в виде строки
   */
  const getReactionStatus = () => {
    switch (props.reaction.kind) {
      case ReactionKind.Accept:
        return t('Accepted')
      case ReactionKind.Reject:
        return t('Rejected')
      default:
        return null
    }
  }

  return (
    <div class={`${styles.card} ${props.isReply ? styles.reply : ''}`}>
      <div class={styles.header}>
        <div class={styles.userInfo}>
          <img
            src={props.reaction.created_by?.pic || '/images/default-avatar.png'}
            alt={props.reaction.created_by?.name || t('Anonymous')}
            class={styles.avatar}
          />
          <div class={styles.nameDate}>
            <span class={styles.name}>{props.reaction.created_by?.name || t('Anonymous')}</span>
            <span class={styles.date}>{formatDate(props.reaction.created_at)}</span>
            <Show when={getReactionStatus()}>
              <span class={styles.status}>{getReactionStatus()}</span>
            </Show>
          </div>
        </div>
        <Show when={!props.isReply && canUserModerate() && !isProcessing()}>
          <div class={styles.actions}>
            <button
              class={styles.actionButton}
              onClick={handleApprove}
              title={t('Accept suggestion')}
              disabled={props.reaction.kind === ReactionKind.Accept}
            >
              <Icon name="check" />
            </button>
            <button
              class={styles.actionButton}
              onClick={handleReject}
              title={t('Reject suggestion')}
              disabled={props.reaction.kind === ReactionKind.Reject}
            >
              <Icon name="close" />
            </button>
          </div>
        </Show>
      </div>

      <div class={styles.content}>
        <p class={`${styles.text} ${isExpanded() ? styles.expanded : ''}`}>{props.reaction.body || ''}</p>
        <Show when={shouldShowExpand()}>
          <button class={styles.expandButton} onClick={() => setIsExpanded(true)}>
            {t('Show more')}
          </button>
        </Show>
      </div>

      <div class={styles.footer}>
        <Show when={!props.isReply}>
          <button class={styles.replyButton} onClick={() => props.onReply?.(props.reaction.id)}>
            {t('Reply')}
          </button>
        </Show>
        <RatingControl
          comment={props.reaction}
          myRate={props.reaction.kind as ReactionKind | undefined}
          class={styles.votes}
        />
      </div>
    </div>
  )
}
