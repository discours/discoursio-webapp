import {
  Accessor,
  Component,
  JSX,
  batch,
  createContext,
  createEffect,
  createResource,
  createSignal,
  on,
  useContext
} from 'solid-js'
import { createStore } from 'solid-js/store'

import followMutation from '~/graphql/mutation/core/follow'
import unfollowMutation from '~/graphql/mutation/core/unfollow'
import loadAuthorFollowers from '~/graphql/query/core/author-followers'
import { Author, CommonResult, Community, FollowingEntity, Topic } from '~/graphql/schema/core.gen'
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
  const [loading, setLoading] = createSignal(false)
  const [followers, setFollowers] = createSignal<Author[]>([])
  const { showModal } = useUI()

  const [state, setState] = createStore<FollowingData>({
    authors: [],
    topics: [],
    communities: []
  })

  const getToken = () => session()?.access_token

  const [follows] = createResource(getToken, async (token) => {
    if (!token) return null
    const result = await client()
      ?.query(loadAuthorFollowers, {
        user: session()?.user?.id
      })
      .toPromise()
    return result?.data || null
  })

  createEffect(
    on(
      follows,
      (data) => {
        if (!data) return
        batch(() => {
          setState((prev) => ({
            ...prev,
            authors: data.authors || [],
            topics: data.topics || [],
            communities: data.communities || []
          }))
          if (data.followers) {
            setFollowers(data.followers)
          }
        })
      },
      { defer: true }
    )
  )

  const fetchData = async () => {
    setLoading(true)
    try {
      if (session()?.access_token) {
        const result = await client()?.query(loadAuthorFollowers, { user: session()?.user?.id }).toPromise()
        if (result?.data) {
          setState((subs: FollowingData) => {
            if (result.data.authors) subs.authors = result.data.authors as Author[]
            if (result.data.topics) subs.topics = result.data.topics as Topic[]
            return subs
          })
        }
      }
    } catch (error) {
      console.error('[context.following] cannot get subs', error)
    } finally {
      setLoading(false)
    }
  }

  const follow = async (what: FollowingEntity, slug: string) => {
    if (!session()?.access_token) {
      showModal('auth')
      return
    }
    try {
      const resp = await client()?.mutation(followMutation, { what, slug }).toPromise()
      if (!resp || resp.error) return
      const result = resp?.data?.follow
      if (!result) return
      setState((subs) => {
        if (result.authors) subs['authors'] = result.authors
        if (result.topics) subs['topics'] = result.topics
        return subs
      })
      return result
    } catch (error) {
      console.error(error)
    }
  }

  const unfollow = async (what: FollowingEntity, slug: string) => {
    if (!session()?.access_token) {
      showModal('auth')
      return
    }
    try {
      const resp = await client()?.mutation(unfollowMutation, { what, slug }).toPromise()
      const result = resp?.data?.unfollow
      if (!result) return
      if (result.error) return
      setState((subs) => {
        if (result.authors) subs['authors'] = result.authors || []
        if (result.topics) subs['topics'] = result.topics || []
        return subs
      })
      return result
    } catch (error) {
      console.error(error)
    }
  }

  createEffect(
    on(
      () => session?.()?.user?.app_data,
      (appdata) => {
        if (appdata) {
          const { authors, followers, topics } = appdata
          setState((subs) => {
            if (authors) subs.authors = authors
            if (topics) subs.topics = topics
            return subs
          })
          setFollowers(followers)
          if (!authors) fetchData()
        }
      }
    )
  )
  const [followingLoading, setFollowingLoading] = createSignal<boolean>(false)
  const changeFollowing = async (
    isFollowed: boolean,
    what: FollowingEntity,
    slug: string
  ): Promise<boolean> => {
    let hasChanged = false

    if (!session()?.access_token) {
      showModal('auth')
      return isFollowed
    }
    setFollowingLoading(true)
    try {
      const result = isFollowed ? await unfollow(what, slug) : await follow(what, slug)

      if (result) {
        const key = `${what.toLowerCase()}s` as keyof FollowingData
        const currentFollows = state[key]
        hasChanged = result[key]?.length !== currentFollows?.length
        setState((subs) => {
          if (result.authors) {
            subs.authors = result.authors as Author[]
          }
          if (result.topics) subs.topics = result.topics as Topic[]
          if (result.communities) subs.communities = result.communities as Community[]
          return subs
        })
      }
    } catch (error) {
      console.error(error)
    }
    setFollowingLoading(false)

    const r = hasChanged ? isFollowed : !isFollowed
    return r
  }

  const value: FollowingContextType = {
    loading: loading,
    follows: state,
    setFollows: setState,
    followers: followers,
    loadFollows: fetchData,
    follow,
    unfollow,
    followingLoading,
    changeFollowing
  }

  return <FollowingContext.Provider value={value}>{props.children}</FollowingContext.Provider>
}
