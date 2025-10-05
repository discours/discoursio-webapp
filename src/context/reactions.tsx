import type { Accessor, JSX } from 'solid-js'
import { createContext, createSignal, onCleanup, useContext } from 'solid-js'
import { toast } from 'solid-sonner'
import { loadCommentsBranch as loadCommentsBranchApi, loadReactions } from '~/graphql/api/public'
import {
  MutationCreate_ReactionArgs,
  MutationUpdate_ReactionArgs,
  QueryLoad_Comments_BranchArgs,
  QueryLoad_Reactions_ByArgs,
  Reaction,
  ReactionKind
} from '~/graphql/generated/graphql'
import createReactionMutation from '~/graphql/mutation/core/reaction-create'
import destroyReactionMutation from '~/graphql/mutation/core/reaction-destroy'
import updateReactionMutation from '~/graphql/mutation/core/reaction-update'
import { useLocalize } from './localize'
import { useSession } from './session'

/**
 * Определяет тип данных для контекста реакций.
 * @interface ReactionsContextType
 * @property {Accessor<Record<number, Reaction>>} reactionEntities - Объект с реакциями, где ключ - ID реакции.
 * @property {Accessor<Record<number, Reaction[]>>} reactionsByShout - Объект с массивами реакций, сгруппированными по ID статьи.
 * @property {Accessor<Record<number, Reaction[]>>} commentsByAuthor - Объект с массивами комментариев, сгруппированными по ID автора.
 * @property {(args: QueryLoad_Reactions_ByArgs) => Promise<Reaction[]>} loadReactionsBy - Функция для загрузки реакций по заданным параметрам.
 * @property {(reaction: MutationCreate_ReactionArgs) => Promise<Reaction | undefined>} createShoutReaction - Функция для создания новой реакции (комментария).
 * @property {(reaction: MutationUpdate_ReactionArgs) => Promise<{ error?: string; reaction?: Reaction }>} updateShoutReaction - Функция для обновления существующей реакции.
 * @property {(id: number) => Promise<{ error: string } | null>} deleteShoutReaction - Функция для удаления реакции по ID.
 * @property {(rrr: Reaction[]) => void} addShoutReactions - Функция для добавления или обновления реакций в локальном хранилище.
 * @property {Accessor<boolean>} reactionsLoading - Флаг, указывающий на процесс загрузки реакций.
 * @property {(params: QueryLoad_Comments_BranchArgs) => Promise<Reaction[]>} loadCommentsBranch - Функция для загрузки ветки комментариев.
 */
type ReactionsContextType = {
  reactionEntities: Accessor<Record<number, Reaction>>
  reactionsByShout: Accessor<Record<number, Reaction[]>>
  commentsByAuthor: Accessor<Record<number, Reaction[]>>
  loadReactionsBy: (args: QueryLoad_Reactions_ByArgs) => Promise<Reaction[]>
  createShoutReaction: (reaction: MutationCreate_ReactionArgs) => Promise<Reaction | undefined>
  updateShoutReaction: (reaction: MutationUpdate_ReactionArgs) => Promise<{ error?: string; reaction?: Reaction }>
  deleteShoutReaction: (id: number) => Promise<{ error: string } | null>
  addShoutReactions: (rrr: Reaction[]) => void
  reactionsLoading: Accessor<boolean>
  loadCommentsBranch: (params: QueryLoad_Comments_BranchArgs) => Promise<Reaction[]>
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
  const { client } = useSession()

  const addShoutReactions = (rrr: Reaction[]) => {
    const newReactionEntities = { ...reactionEntities() }
    const newReactionsByShout = { ...reactionsByShout() }
    const newCommentsByAuthor = { ...commentsByAuthor() }

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

      // 🔧  Обновляем комментарии по автору для отображения в профиле
      if (reaction.kind === ReactionKind.Comment && reaction.created_by?.id) {
        const authorId = reaction.created_by.id
        if (!newCommentsByAuthor[authorId]) {
          newCommentsByAuthor[authorId] = []
        }

        const existingCommentIndex = newCommentsByAuthor[authorId].findIndex((r) => r.id === reaction.id)
        if (existingCommentIndex === -1) {
          newCommentsByAuthor[authorId].push(reaction)
        } else {
          newCommentsByAuthor[authorId][existingCommentIndex] = reaction
        }
      }
    })

    console.log('[ReactionsProvider] Updated state:', {
      entities: Object.keys(newReactionEntities).length,
      byShout: Object.keys(newReactionsByShout).length,
      commentsByAuthor: Object.keys(newCommentsByAuthor).length
    })

    setReactionEntities(newReactionEntities)
    setReactionsByShout(newReactionsByShout)
    setCommentsByAuthor(newCommentsByAuthor)
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

    try {
      console.log('[ReactionsProvider] Creating reaction with input:', input)

      // 🔧 ВАЛИДАЦИЯ: проверяем обязательные поля
      if (!input.reaction?.shout || !input.reaction?.kind) {
        console.error('[ReactionsProvider] Invalid reaction input:', input)
        throw new Error('Missing required fields: shout or kind')
      }

      const resp = await client()?.mutation(createReactionMutation, input).toPromise()

      if (!resp) {
        console.error('[ReactionsProvider] No response from mutation')
        throw new Error('No response from server')
      }

      const result = resp?.data?.create_reaction
      if (!result) {
        console.error('[ReactionsProvider] createShoutReaction - no result:', resp)
        throw new Error('Server returned no data')
      }

      const { error, reaction } = result

      if (error) {
        console.error('[ReactionsProvider] Server error:', error)
        toast.error(t(error))
        throw new Error(error)
      }

      if (reaction) {
        console.log('[ReactionsProvider] Reaction created successfully:', reaction.id)
        updateShoutInStores(reaction)
        return reaction
      } else {
        console.error('[ReactionsProvider] No reaction in response')
        throw new Error('Server returned no reaction')
      }
    } catch (error) {
      console.error('[ReactionsProvider] Error in createShoutReaction:', error)
      throw error
    } finally {
      setReactionsLoading(false)
    }
  }

  const deleteShoutReaction = async (reaction_id: number): Promise<{ error: string; reaction?: string } | null> => {
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
              next[reactionToDelete.shout.id] = next[reactionToDelete.shout.id].filter((r) => r.id !== reaction_id)
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
      toast.error(t(error))
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
      const authorIndex = newReactionsByAuthor[reaction.created_by.id]?.findIndex((r) => r.id === reaction.id)
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

  /**
   * Загружает комментарии с учетом их иерархической структуры
   *
   * @param params Параметры запроса для загрузки ветки комментариев
   * @returns Promise с массивом комментариев, включая предзагруженные ответы
   */
  const loadCommentsBranch = async (params: QueryLoad_Comments_BranchArgs): Promise<Reaction[]> => {
    setReactionsLoading(true)

    try {
      if (!params.shout) {
        throw new Error('reactions provider: missing required shout ID')
      }

      // Выполняем запрос к API
      const apiLoader = loadCommentsBranchApi(params)
      const result = await apiLoader()

      // Проверяем, что результат существует и является массивом
      if (!result || !Array.isArray(result)) {
        console.warn('[ReactionsProvider] Invalid result format from loadCommentsBranch:', result)
        return []
      }

      if (result.length > 0) {
        // Собираем все комментарии и их первые ответы
        const allComments: Reaction[] = []

        result.forEach((comment: Reaction) => {
          if (!comment || typeof comment !== 'object') {
            console.warn('[ReactionsProvider] Invalid comment in result:', comment)
            return
          }

          // Проверяем наличие обязательных полей
          if (!comment.id || !comment.shout?.id) {
            console.warn('[ReactionsProvider] Comment missing required fields:', comment)
            return
          }

          allComments.push(comment)

          // Добавляем предзагруженные ответы, если они есть
          if (comment.first_replies && Array.isArray(comment.first_replies)) {
            const replies = comment.first_replies as Reaction[]
            allComments.push(
              ...replies.filter((reply) => {
                if (!reply || typeof reply !== 'object') {
                  console.warn('[ReactionsProvider] Invalid reply in first_replies:', reply)
                  return false
                }
                if (!reply.id || !reply.shout?.id) {
                  console.warn('[ReactionsProvider] Reply missing required fields:', reply)
                  return false
                }
                return true
              })
            )
          }
        })

        // Добавляем все комментарии в хранилище
        if (allComments.length > 0) {
          addShoutReactions(allComments)
        }
      }

      return result
    } catch (error) {
      console.error('[ReactionsProvider] LoadCommentsBranch error:', error)
      return []
    } finally {
      setReactionsLoading(false)
    }
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
    reactionsLoading,
    loadCommentsBranch
  }

  return <ReactionsContext.Provider value={value}>{props.children}</ReactionsContext.Provider>
}
