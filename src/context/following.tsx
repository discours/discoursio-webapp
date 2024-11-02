import { Accessor, JSX, createContext, createEffect, createSignal, on, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'

import followMutation from '~/graphql/mutation/core/follow'
import unfollowMutation from '~/graphql/mutation/core/unfollow'
import loadAuthorFollowers from '~/graphql/query/core/author-followers'
import { Author, CommonResult, Community, FollowingEntity, Topic } from '~/graphql/schema/core.gen'
import { useSession } from './session'

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

const EMPTY_SUBSCRIPTIONS: FollowingData = {
  topics: [] as Topic[],
  authors: [] as Author[],
  communities: [] as Community[]
}

export const FollowingProvider = (props: { children: JSX.Element }) => {
  const [loading, setLoading] = createSignal<boolean>(false)
  const [followers, setFollowers] = createSignal<Author[]>([] as Author[])
  const [follows, setFollows] = createStore<FollowingData>(EMPTY_SUBSCRIPTIONS)
  const { session, client } = useSession()

  const fetchData = async () => {
    setLoading(true)
    try {
      if (session()?.access_token) {
        // console.debug('[context.following] fetching subs data...')
        const result = await client()?.query(loadAuthorFollowers, { user: session()?.user?.id }).toPromise()
        if (result) {
          setFollows((_: FollowingData) => {
            return { ...EMPTY_SUBSCRIPTIONS, ...result } as FollowingData
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
    // console.debug('[context.following] follow', what, slug)
    if (!session()?.access_token) return
    try {
      const resp = await client()?.mutation(followMutation, { what, slug }).toPromise()
      if (!resp || resp.error) return
      const result = resp?.data?.follow
      // console.debug('[context.following] follow', result)
      if (!result) return
      setFollows((subs) => {
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
    if (!session()?.access_token) return
    try {
      const resp = await client()?.mutation(unfollowMutation, { what, slug }).toPromise()
      const result = resp?.data?.unfollow
      // console.debug('[context.following] unfollow', result)
      if (!result) return
      if (result.error) return
      setFollows((subs) => {
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
          setFollows({ authors, topics })
          setFollowers(followers)
          if (!authors) fetchData()
        }
      }
    )
  )
  const { requireAuthentication } = useSession()
  const [followingLoading, setFollowingLoading] = createSignal<boolean>(false)
  const changeFollowing = async (
    isFollowed: boolean,
    what: FollowingEntity,
    slug: string
  ): Promise<boolean> => {
    let hasChanged = false

    await requireAuthentication(async () => {
      setFollowingLoading(true)
      // console.debug('[handleFollowClick] slug', slug);
      try {
        const result = isFollowed ? await unfollow(what, slug) : await follow(what, slug)

        if (result) {
          const key = `${what.toLowerCase()}s` as 'authors' | 'topics' | 'communities'
          hasChanged = result[key]?.length !== follows[key]?.length
          setFollows((subs) => {
            if (result.authors) {
              subs.authors = result.authors as Author[]
              // console.debug('authors subs updated', result.authors);
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
    }, 'follow')

    const r = hasChanged ? isFollowed : !isFollowed
    // console.debug(`now is ${!r ? 'NOT ' : ''}following`);
    return r
  }

  const value: FollowingContextType = {
    loading,
    follows,
    setFollows,
    followers,
    loadFollows: fetchData,
    follow,
    unfollow,
    followingLoading,
    changeFollowing
  }

  return <FollowingContext.Provider value={value}>{props.children}</FollowingContext.Provider>
}
