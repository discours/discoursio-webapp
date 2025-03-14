import type { Accessor, JSX } from 'solid-js'
import { createContext, createSignal, onCleanup, useContext } from 'solid-js'
import { loadReactions } from '~/graphql/api/public'
import createReactionMutation from '~/graphql/mutation/core/reaction-create'
import destroyReactionMutation from '~/graphql/mutation/core/reaction-destroy'
import updateReactionMutation from '~/graphql/mutation/core/reaction-update'
import {
  MutationCreate_ReactionArgs,
  MutationUpdate_ReactionArgs,
  QueryLoad_Reactions_ByArgs,
  Reaction
} from '~/graphql/schema/core.gen'
import { useLocalize } from './localize'
import { useSession } from './session'
import { useSnackbar } from './ui'
type ReactionsContextType = {
  reactionEntities: Accessor<Record<number, Reaction>>
  reactionsByShout: Accessor<Record<number, Reaction[]>>
  commentsByAuthor: Accessor<Record<number, Reaction[]>>
  loadReactionsBy: (args: QueryLoad_Reactions_ByArgs) => Promise<Reaction[]>
  createShoutReaction: (reaction: MutationCreate_ReactionArgs) => Promise<Reaction | undefined>
  updateShoutReaction: (
    reaction: MutationUpdate_ReactionArgs
  ) => Promise<{ error?: string; reaction?: Reaction }>
  deleteShoutReaction: (id: number) => Promise<{ error: string } | null>
  addShoutReactions: (rrr: Reaction[]) => void
  reactionsLoading: Accessor<boolean>
}

const ReactionsContext = createContext<ReactionsContextType>({} as ReactionsContextType)

export const useReactions = () => useContext(ReactionsContext)

export const ReactionsProvider = (props: { children: JSX.Element }) => {
  const [reactionsLoading, setReactionsLoading] = createSignal(false)
  const [reactionEntities, setReactionEntities] = createSignal<Record<number, Reaction>>({})
  const [reactionsByShout, setReactionsByShout] = createSignal<Record<number, Reaction[]>>({})
  const [reactionsByAuthor, setReactionsByAuthor] = createSignal<Record<number, Reaction[]>>({})
  const [commentsByAuthor, setCommentsByAuthor] = createSignal<Record<number, Reaction[]>>({})
  const { t } = useLocalize()
  const { showSnackbar } = useSnackbar()
  const { client } = useSession()

  const addShoutReactions = (rrr: Reaction[]) => {
    const newReactionEntities = { ...reactionEntities() }
    const newReactionsByShout = { ...reactionsByShout() }

    rrr.forEach((reaction) => {
      // Проверяем валидность данных
      if (!reaction.id || !reaction.shout?.id) {
        console.warn('[ReactionsProvider] Invalid reaction:', reaction)
        return
      }

      newReactionEntities[reaction.id] = reaction

      if (!newReactionsByShout[reaction.shout.id]) {
        newReactionsByShout[reaction.shout.id] = []
      }

      // Проверяем на дубликаты
      const existingIndex = newReactionsByShout[reaction.shout.id].findIndex((r) => r.id === reaction.id)

      if (existingIndex === -1) {
        newReactionsByShout[reaction.shout.id].push(reaction)
      } else {
        newReactionsByShout[reaction.shout.id][existingIndex] = reaction
      }
    })

    console.log('[ReactionsProvider] Updated state:', {
      entities: Object.keys(newReactionEntities).length,
      byShout: Object.keys(newReactionsByShout).length
    })

    setReactionEntities(newReactionEntities)
    setReactionsByShout(newReactionsByShout)
  }

  const loadReactionsBy = async (opts: QueryLoad_Reactions_ByArgs): Promise<Reaction[]> => {
    setReactionsLoading(true)

    try {
      if (!opts.by) {
        throw new Error('reactions provider got wrong opts')
      }

      const fetcher = await loadReactions(opts)
      const result = await fetcher()

      console.log('[ReactionsProvider] Loaded reactions:', {
        count: result?.length,
        data: result
      })

      if (result?.length) {
        addShoutReactions(result)
      }

      return result || []
    } catch (error) {
      console.error('[ReactionsProvider] Load error:', error)
      return []
    } finally {
      setReactionsLoading(false)
    }
  }

  const createShoutReaction = async (input: MutationCreate_ReactionArgs): Promise<Reaction | undefined> => {
    setReactionsLoading(true)
    const resp = await client()?.mutation(createReactionMutation, input).toPromise()
    const result = resp?.data?.create_reaction
    if (!result) {
      console.error('[context.reactions] createShoutReaction', result)
      throw new Error('cannot create reaction')
    }
    const { error, reaction } = result
    if (error) await showSnackbar({ type: 'error', body: t(error) })
    if (reaction) {
      updateShoutInStores(reaction)
    }
    setReactionsLoading(false)
    return reaction
  }

  const deleteShoutReaction = async (
    reaction_id: number
  ): Promise<{ error: string; reaction?: string } | null> => {
    setReactionsLoading(true)
    if (reaction_id) {
      const resp = await client()?.mutation(destroyReactionMutation, { reaction_id }).toPromise()
      const result = resp?.data?.delete_reaction

      if (!result.error) {
        const reactionToDelete = reactionEntities()[reaction_id]

        if (reactionToDelete) {
          setReactionEntities((prev) => {
            const next = { ...prev }
            delete next[reaction_id]
            return next
          })

          setReactionsByShout((prev) => {
            const next = { ...prev }
            if (next[reactionToDelete.shout.id]) {
              next[reactionToDelete.shout.id] = next[reactionToDelete.shout.id].filter(
                (r) => r.id !== reaction_id
              )
            }
            return next
          })

          setReactionsByAuthor((prev) => {
            const next = { ...prev }
            if (next[reactionToDelete.created_by.id]) {
              next[reactionToDelete.created_by.id] = next[reactionToDelete.created_by.id].filter(
                (r) => r.id !== reaction_id
              )
            }
            return next
          })

          setCommentsByAuthor((prev) => {
            const next = { ...prev }
            if (next[reactionToDelete.created_by.id]) {
              next[reactionToDelete.created_by.id] = next[reactionToDelete.created_by.id].filter(
                (r) => r.id !== reaction_id
              )
            }
            return next
          })
        }
      }

      setReactionsLoading(false)
      return result
    }
    setReactionsLoading(false)
    return null
  }

  const updateShoutReaction = async (
    input: MutationUpdate_ReactionArgs
  ): Promise<{ error?: string; reaction?: Reaction }> => {
    setReactionsLoading(true)
    const resp = await client()?.mutation(updateReactionMutation, input).toPromise()
    const result = resp?.data?.update_reaction
    if (!result) {
      console.error('[context.reactions] updateShoutReaction', result)
      return { error: 'cannot update reaction' }
    }
    const { error, reaction } = result
    if (error) {
      await showSnackbar({ type: 'error', body: t(error) })
      return { error }
    }
    if (reaction?.id) {
      const newReactionEntities = { ...reactionEntities() }
      newReactionEntities[reaction.id] = reaction

      const newReactionsByShout = { ...reactionsByShout() }
      if (!reaction.shout?.id) {
        console.error('[ReactionsProvider] updateShoutReaction', reaction)
        return { error: 'cannot update reaction' }
      }
      const shoutIndex = newReactionsByShout[reaction.shout.id]?.findIndex((r) => r.id === reaction.id)
      if (shoutIndex !== undefined && shoutIndex !== -1) {
        newReactionsByShout[reaction.shout.id][shoutIndex] = reaction
      }

      const newReactionsByAuthor = { ...reactionsByAuthor() }
      const authorIndex = newReactionsByAuthor[reaction.created_by.id]?.findIndex(
        (r) => r.id === reaction.id
      )
      if (authorIndex !== undefined && authorIndex !== -1) {
        newReactionsByAuthor[reaction.created_by.id][authorIndex] = reaction
      }

      setReactionEntities(newReactionEntities)
      setReactionsByShout(newReactionsByShout)
      setReactionsByAuthor(newReactionsByAuthor)
    }
    setReactionsLoading(false)
    return { error, reaction }
  }

  const updateShoutInStores = (reaction: Reaction) => {
    const newReactionEntities = { ...reactionEntities() }
    newReactionEntities[reaction.id] = reaction

    const newReactionsByShout = { ...reactionsByShout() }
    if (reaction.shout) {
      // Обновляем статистику шаута
      const shoutIndex = newReactionsByShout[reaction.shout.id]?.findIndex((r) => r.id === reaction.id)
      if (shoutIndex !== undefined && shoutIndex !== -1) {
        newReactionsByShout[reaction.shout.id][shoutIndex] = reaction
      }
    }

    setReactionEntities(newReactionEntities)
    setReactionsByShout(newReactionsByShout)
  }

  onCleanup(() => {
    setReactionEntities({})
    setReactionsByShout({})
    setReactionsByAuthor({})
    setCommentsByAuthor({})
  })

  const value: ReactionsContextType = {
    reactionEntities,
    reactionsByShout,
    commentsByAuthor,
    loadReactionsBy,
    createShoutReaction,
    updateShoutReaction,
    deleteShoutReaction,
    addShoutReactions,
    reactionsLoading
  }

  return <ReactionsContext.Provider value={value}>{props.children}</ReactionsContext.Provider>
}
