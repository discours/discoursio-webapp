import {
  Accessor,
  batch,
  Component,
  createContext,
  createEffect,
  createResource,
  createSignal,
  JSX,
  on,
  Resource,
  useContext
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { Author, CommonResult, Community, FollowingEntity, Topic } from '~/graphql/generated/graphql'
import followMutation from '~/graphql/mutation/core/follow'
import unfollowMutation from '~/graphql/mutation/core/unfollow'
import loadAuthorFollowers from '~/graphql/query/core/author-followers'
import loadAuthorFollowsQuery from '~/graphql/query/core/author-follows'
import { useAuthors } from './authors'
import { useSession } from './session'
import { useUI } from './ui'

export type FollowsFilter = 'all' | 'authors' | 'topics' | 'communities'

interface FollowingContextType {
  loading: Accessor<boolean>
  followers: Accessor<Author[]>
  setFollows: (follows: FollowingData) => void
  follows: FollowingData
  loadFollows: () => void
  follow: (what: FollowingEntity, slug: string) => Promise<CommonResult | undefined>
  unfollow: (what: FollowingEntity, slug: string) => Promise<CommonResult | undefined>
  followingLoading: Accessor<boolean>
  changeFollowing: (isFollowed: boolean, what: FollowingEntity, slug: string) => Promise<boolean>
  // Resourse for follows
  followsResource: Resource<{ authors: Author[]; topics: Topic[] } | null>
}

const FollowingContext = createContext<FollowingContextType>({
  followers: () => [],
  loading: () => false,
  setFollows: (_follows: FollowingData) => undefined,
  follows: {},
  loadFollows: () => undefined,
  follow: (_what: FollowingEntity, _slug: string) => undefined,
  unfollow: (_what: FollowingEntity, _slug: string) => undefined,
  followingLoading: () => false,
  changeFollowing: async (_isFollowed: boolean, _what: FollowingEntity, _slug: string) => false
} as unknown as FollowingContextType)

export function useFollowing() {
  return useContext(FollowingContext)
}

export interface FollowingData {
  authors?: Author[]
  topics?: Topic[]
  communities?: Community[]
}

export const FollowingProvider: Component<{ children: JSX.Element }> = (props) => {
  const { session, client } = useSession()
  const { addAuthors } = useAuthors()
  const [followers, setFollowers] = createSignal<Author[]>([])
  const [followingLoading, setFollowingLoading] = createSignal<boolean>(false)
  const { showModal } = useUI()

  const [state, setState] = createStore<FollowingData>({
    authors: [],
    topics: [],
    communities: []
  })

  // Основной ресурс для загрузки подписок текущего пользователя
  const [followsResource] = createResource(
    () => session()?.author?.slug,
    async (slug) => {
      if (!(slug && client())) return null
      console.log('[FollowingContext] Loading follows for user:', slug)
      const response = await client()?.query(loadAuthorFollowsQuery, { slug }).toPromise()
      const result = response?.data?.get_author_follows
      console.log('[FollowingContext] Loaded follows:', {
        authors: result?.authors?.length || 0,
        topics: result?.topics?.length || 0
      })
      return result || { authors: [], topics: [] }
    }
  )

  createEffect(
    on(
      [followsResource],
      ([resourceData]) => {
        if (!resourceData) return

        batch(() => {
          setState((prev) => ({
            ...prev,
            authors: resourceData?.authors || [],
            topics: resourceData?.topics || [],
            communities: resourceData?.communities || []
          }))
        })
      },
      { defer: true }
    )
  )

  const fetchData = async () => {
    setFollowingLoading(true)
    try {
      if (session()?.token) {
        const result = await client()?.query(loadAuthorFollowers, { user: session()?.author?.id }).toPromise()
        if (result?.data) {
          setState((subs: FollowingData) => {
            if (result.data.get_author_followers) subs.authors = result.data.get_author_followers as Author[]
            return subs
          })
        }
      }
    } catch (error) {
      console.error('[context.following] cannot get subs', error)
    } finally {
      setFollowingLoading(false)
    }
  }

  const follow = async (what: FollowingEntity, slug: string) => {
    if (!session()?.token) {
      showModal('auth')
      return
    }
    try {
      console.log('[FollowingContext] Following:', what, slug)
      const resp = await client()?.mutation(followMutation, { what, slug }).toPromise()
      if (!resp || resp.error) return
      const result = resp?.data?.follow
      if (!result) return

      console.log('[FollowingContext] Follow result:', {
        authorsCount: result.authors?.length || 0,
        topicsCount: result.topics?.length || 0,
        error: result.error
      })

      // Обновляем состояние контекста с данными с сервера (даже при ошибке "already following")
      setState((subs) => {
        if (result.authors) subs['authors'] = result.authors
        if (result.topics) subs['topics'] = result.topics
        return subs
      })

      // 🔄 ВАЖНО: Обновляем статистику авторов в authors context
      if (result.authors && result.authors.length > 0) {
        console.log(
          '[FollowingContext] Updating author stats after follow:',
          result.authors.map((a: Author) => ({
            slug: a.slug,
            followers: a.stat?.followers
          }))
        )
        addAuthors(result.authors)
      }

      return result
    } catch (error) {
      console.error('[FollowingContext] Follow error:', error)
    }
  }

  const unfollow = async (what: FollowingEntity, slug: string) => {
    if (!session()?.token) {
      showModal('auth')
      return null
    }
    try {
      console.log('[FollowingContext] Unfollowing:', what, slug)
      const resp = await client()?.mutation(unfollowMutation, { what, slug }).toPromise()
      const result = resp?.data?.unfollow

      // 🔄 ВАЖНО: Всегда возвращаем результат, даже при ошибках
      if (!result) {
        console.log('[FollowingContext] Unfollow: no result from server')
        return { error: 'no result', authors: [], topics: [], communities: [] }
      }

      console.log('[FollowingContext] Unfollow result:', {
        authorsCount: result.authors?.length || 0,
        topicsCount: result.topics?.length || 0,
        error: result.error
      })

      // Обновляем состояние контекста только если нет ошибки
      if (!result.error) {
        setState((subs) => {
          if (result.authors) subs['authors'] = result.authors || []
          if (result.topics) subs['topics'] = result.topics || []
          return subs
        })

        // 🔄 ВАЖНО: Обновляем статистику авторов в authors context после unfollow
        if (result.authors && result.authors.length > 0) {
          console.log(
            '[FollowingContext] Updating author stats after unfollow:',
            result.authors.map((a: Author) => ({
              slug: a.slug,
              followers: a.stat?.followers
            }))
          )
          addAuthors(result.authors)
        }
      }

      return result
    } catch (error) {
      console.error('[FollowingContext] Unfollow error:', error)
      return { error: 'network error', authors: [], topics: [], communities: [] }
    }
  }

  createEffect(
    on(
      [() => session?.()?.author, () => followsResource?.()?.authors, () => followsResource?.()?.topics],
      ([author, followedAuthors, followedTopics]) => {
        if (author) {
          setState((subs) => {
            if (followedAuthors) subs.authors = followedAuthors
            if (followedTopics) subs.topics = followedTopics
            return subs
          })
          setFollowers(followers)
          if (!followedAuthors) void fetchData()
        }
      }
    )
  )

  const changeFollowing = async (isFollowed: boolean, what: FollowingEntity, slug: string): Promise<boolean> => {
    console.log('[FollowingContext] 🎬 changeFollowing START:', { isFollowed, what, slug })

    if (!session()?.token) {
      showModal('auth')
      return isFollowed
    }

    setFollowingLoading(true)
    try {
      console.log('[FollowingContext] 🔄 Calling operation:', isFollowed ? 'unfollow' : 'follow')
      const result = isFollowed ? await unfollow(what, slug) : await follow(what, slug)

      console.log('[FollowingContext] 🎭 Operation completed, result exists:', !!result)

      if (result) {
        console.log('[FollowingContext] 📦 Raw server result:', {
          isFollowed,
          what,
          slug,
          'result.error': result.error,
          'result.authors?.length': result.authors?.length,
          'result.topics?.length': result.topics?.length
        })

        // Специальная обработка для ошибок, которые означают успех
        const isUnfollowNotFound =
          isFollowed && (result.error === 'following was not found' || result.error === 'Not following')
        // Специальная обработка для ошибки "already following" при follow
        const isAlreadyFollowing = !isFollowed && result.error === 'already following'

        console.log('[FollowingContext] 🎯 Condition check:', {
          'result.error': result.error,
          '!result.error': !result.error,
          isUnfollowNotFound,
          isAlreadyFollowing,
          'final condition': !result.error || isUnfollowNotFound || isAlreadyFollowing
        })

        if (!result.error || isUnfollowNotFound || isAlreadyFollowing) {
          console.log('[FollowingContext] 🚀 Processing result:', {
            isFollowed,
            what,
            slug,
            'result.error': result.error,
            isUnfollowNotFound,
            isAlreadyFollowing,
            'result.authors?.length': result.authors?.length
          })

          // Обновляем состояние контекста с новыми данными с сервера
          // ВАЖНО: Обновляем даже при ошибке "already following", так как сервер возвращает актуальный список
          setState((subs) => {
            if (result.authors) {
              subs.authors = result.authors as Author[]
              console.log('[FollowingContext] Updated follows.authors with', result.authors.length, 'authors')
            }
            if (result.topics) {
              subs.topics = result.topics as Topic[]
            }
            if (result.communities) {
              subs.communities = result.communities as Community[]
            }
            return subs
          })

          // Определяем новое состояние подписки на основе ответа сервера
          let newFollowState = false

          if (isUnfollowNotFound) {
            // Если подписка не найдена при unfollow, значит пользователь не подписан
            newFollowState = false
            console.log('[FollowingContext] Unfollow: following not found, treating as successful unfollow')
          } else if (isAlreadyFollowing) {
            // Если пользователь уже подписан, состояние остается true (уже подписан)
            newFollowState = true
            console.log('[FollowingContext] Follow: already following, state remains true')
          } else if (isFollowed) {
            // Если это была операция отписки (unfollow), то состояние = false
            newFollowState = false
            console.log('[FollowingContext] Unfollow: operation successful, state = false')
          } else {
            // Если это была операция подписки (follow), проверяем по данным сервера
            console.log('[FollowingContext] 🔍 Checking server data for', what, slug, {
              isFollowed,
              'result.authors?.length': result.authors?.length,
              'result.topics?.length': result.topics?.length,
              'authors includes slug': result.authors?.some((author: Author) => author.slug === slug)
            })

            if (what === 'AUTHOR' && result.authors) {
              // 🔍 ДИАГНОСТИКА: выводим все slug'и авторов из ответа
              const authorSlugs = result.authors.map((a: Author) => a.slug)
              console.log('[FollowingContext] 🔍 Server returned authors slugs:', authorSlugs)
              console.log('[FollowingContext] 🔍 Looking for slug:', slug)

              newFollowState = result.authors.some((author: Author) => author.slug === slug)
              console.log(
                '[FollowingContext] 📋 Author check result:',
                newFollowState,
                'from',
                result.authors.length,
                'authors'
              )
            } else if (what === 'TOPIC' && result.topics) {
              newFollowState = result.topics.some((topic: Topic) => topic.slug === slug)
            } else if (what === 'COMMUNITY' && result.communities) {
              if (result.communities?.length) {
                // Обычная логика определения состояния
                newFollowState = result.communities.some((community: Community) => community.slug === slug)
              } else {
                // Если нет подписок, то состояние = false
                newFollowState = false
                console.log('[FollowingContext] Unfollow: following not found, treating as successful unfollow')
              }
            }
          }

          console.log('[FollowingContext] New follow state determined from server:', newFollowState, 'for', what, slug)
          return newFollowState
        } else {
          console.error('[FollowingContext] Operation failed with error:', result.error)
        }
      }

      // Если операция не удалась, возвращаем текущее состояние
      return isFollowed
    } catch (error) {
      console.error('changeFollowing error:', error)
      return isFollowed
    } finally {
      setFollowingLoading(false)
    }
  }

  const value: FollowingContextType = {
    loading: () => followsResource.loading,
    follows: state,
    setFollows: setState,
    followers: followers,
    loadFollows: () => {
      // Принудительно перезагружаем ресурс через мутацию состояния
      if (followsResource.latest) {
        setState((prev) => ({
          ...prev,
          authors: followsResource.latest?.authors || [],
          topics: followsResource.latest?.topics || []
        }))
      }
    },
    follow,
    unfollow,
    followingLoading,
    changeFollowing,
    followsResource
  }

  return <FollowingContext.Provider value={value}>{props.children}</FollowingContext.Provider>
}
