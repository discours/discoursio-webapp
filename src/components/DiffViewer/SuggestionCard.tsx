import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { useSnackbar } from '~/context/ui'
import {
  MutationCreate_ReactionArgs,
  Reaction,
  ReactionInput,
  ReactionKind
} from '~/graphql/schema/core.gen'

export const SuggestionCard = (props: {
  reaction: Reaction
}) => {
  const { session } = useSession()
  const { showSnackbar } = useSnackbar()
  const { t } = useLocalize()
  const { createShoutReaction } = useReactions()

  /**
   * Обработчик одобрения статьи
   * @param {Reaction} r - Реакция для одобрения
   */
  const handleApprove = async (r: Reaction) => {
    if (!session()?.user) {
      showSnackbar({ type: 'error', body: t('Please sign in to approve articles') })
      return
    }

    try {
      // create a reaction with kind of accept
      await createShoutReaction({
        reaction: {
          reply_to: r.id,
          shout: r.shout.id,
          kind: ReactionKind.Accept,
          body: ''
        } as ReactionInput
      } as MutationCreate_ReactionArgs)
      showSnackbar({ type: 'success', body: t('Article approved successfully') })
    } catch (error) {
      console.error('[SuggestionsView] Error approving article:', error)
      showSnackbar({ type: 'error', body: t('Failed to approve article') })
    }
  }

  /**
   * Обработчик отклонения статьи
   * @param {Reaction} r - Реакция для отклонения
   */
  const handleReject = async (r: Reaction) => {
    if (!session()?.user) {
      showSnackbar({ type: 'error', body: t('Please sign in to reject articles') })
      return
    }

    try {
      await createShoutReaction({
        reaction: {
          reply_to: r.id,
          shout: r.shout.id,
          kind: ReactionKind.Reject,
          body: ''
        } as ReactionInput
      } as MutationCreate_ReactionArgs)

      showSnackbar({ type: 'success', body: t('Article rejected') })
    } catch (error) {
      console.error('[SuggestionsView] Error rejecting article:', error)
      showSnackbar({ type: 'error', body: t('Failed to reject article') })
    }
  }

  return <></>
}
