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

  // ✅ Реактивный триггер для принудительной перезагрузки подписок
  const [followsRefreshTrigger, setFollowsRefreshTrigger] = createSignal(0)

  // Основной ресурс для загрузки подписок текущего пользователя
  const [followsResource] = createResource(
    () => {
      // Отслеживаем и slug пользователя, и триггер обновления
      const slug = session()?.author?.slug
      const trigger = followsRefreshTrigger()
      return slug ? { slug, trigger } : null
    },
    async (params) => {
      if (!(params?.slug && client())) return null
      const response = await client()?.query(loadAuthorFollowsQuery, { slug: params.slug }).toPromise()
      const result = response?.data?.get_author_follows
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
      const resp = await client()?.mutation(followMutation, { what, slug }).toPromise()
      if (!resp || resp.error) return
      const result = resp?.data?.follow
      if (!result) return

      // Обновляем статистику авторов в authors context
      if (result.authors && result.authors.length > 0) {
        addAuthors(result.authors)
      }

      // Принудительно перезагружаем актуальный список подписок
      setFollowsRefreshTrigger((prev) => prev + 1)

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
      const resp = await client()?.mutation(unfollowMutation, { what, slug }).toPromise()
      const result = resp?.data?.unfollow

      if (!result) {
        return { error: 'no result', authors: [], topics: [], communities: [] }
      }

      // Обновляем статистику авторов в authors context после unfollow
      if (result.authors && result.authors.length > 0) {
        addAuthors(result.authors)
      }

      // Принудительно перезагружаем актуальный список подписок
      setFollowsRefreshTrigger((prev) => prev + 1)

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
    if (!session()?.token) {
      showModal('auth')
      return isFollowed
    }

    setFollowingLoading(true)
    try {
      const result = isFollowed ? await unfollow(what, slug) : await follow(what, slug)

      if (result) {
        // Специальная обработка для ошибок, которые означают успех
        const isUnfollowNotFound =
          isFollowed && (result.error === 'following was not found' || result.error === 'Not following')
        const isAlreadyFollowing = !isFollowed && result.error === 'already following'

        if (!result.error || isUnfollowNotFound || isAlreadyFollowing) {
          // Определяем новое состояние на основе операции
          if (isUnfollowNotFound) {
            return false // Подписка не найдена при unfollow → не подписан
          } else if (isAlreadyFollowing) {
            return true // Уже подписан → остается подписан
          } else {
            return !isFollowed // Инвертируем текущее состояние при успешной операции
          }
        } else {
          console.error('[FollowingContext] Operation failed:', result.error)
        }
      }

      return isFollowed
    } catch (error) {
      console.error('[FollowingContext] changeFollowing error:', error)
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
