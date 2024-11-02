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
  setFollows: (follows: AuthorFollowsResult) => void
  changeFollowing: (what: FollowingEntity, slug: string, value: boolean) => void
  follows: AuthorFollowsResult
  loadFollows: () => void
  follow: (what: FollowingEntity, slug: string) => Promise<CommonResult | undefined>
  unfollow: (what: FollowingEntity, slug: string) => Promise<CommonResult | undefined>
}

const FollowingContext = createContext<FollowingContextType>({
  followers: () => [],
  loading: () => false,
  setFollows: (_follows: AuthorFollowsResult) => undefined,
  follows: {},
  loadFollows: () => undefined,
  follow: (_what: FollowingEntity, _slug: string) => undefined,
  unfollow: (_what: FollowingEntity, _slug: string) => undefined
} as unknown as FollowingContextType)

export function useFollowing() {
  return useContext(FollowingContext)
}

interface AuthorFollowsResult {
  authors?: Author[]
  topics?: Topic[]
  communities?: Community[]
}

const EMPTY_SUBSCRIPTIONS: AuthorFollowsResult = {
  topics: [] as Topic[],
  authors: [] as Author[],
  communities: [] as Community[]
}

export const FollowingProvider = (props: { children: JSX.Element }) => {
  const [loading, setLoading] = createSignal<boolean>(false)
  const [followers, setFollowers] = createSignal<Author[]>([] as Author[])
  const [follows, setFollows] = createStore<AuthorFollowsResult>(EMPTY_SUBSCRIPTIONS)
  const { session, client } = useSession()

  const fetchData = async () => {
    setLoading(true)
    try {
      if (session()?.access_token) {
        console.debug('[context.following] fetching subs data...')
        const result = await client()?.query(loadAuthorFollowers, { user: session()?.user?.id }).toPromise()
        if (result) {
          setFollows((_: AuthorFollowsResult) => {
            return { ...EMPTY_SUBSCRIPTIONS, ...result } as AuthorFollowsResult
          })
        }
      }
    } catch (error) {
      console.warn('[context.following] cannot get subs', error)
    } finally {
      setLoading(false)
    }
  }

  const follow = async (what: FollowingEntity, slug: string) => {
    console.debug('[context.following] follow', what, slug)
    if (!session()?.access_token) return
    try {
      const resp = await client()?.mutation(followMutation, { what, slug }).toPromise()
      if (!resp || resp.error) return
      const result = resp?.data?.follow
      console.debug('[context.following] follow', result)
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
      console.debug('[context.following] unfollow', result)
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

  const changeFollowing = (what: FollowingEntity, slug: string, value = true) => {
    setFollows((prevFollows: AuthorFollowsResult) => {
      const updatedFollows = { ...prevFollows }
      switch (what) {
        case 'TOPIC': {
          if (value) {
            if (!updatedFollows.topics?.some((topic) => topic.slug === slug)) {
              updatedFollows.topics = [...(updatedFollows.topics || []), { slug } as Topic]
            }
          } else {
            updatedFollows.topics = updatedFollows.topics?.filter((topic) => topic.slug !== slug) || []
          }
          break
        }
        case 'COMMUNITY': {
          if (value) {
            if (!updatedFollows.communities?.some((community) => community.slug === slug)) {
              updatedFollows.communities = [...(updatedFollows.communities || []), { slug } as Community]
            }
          } else {
            updatedFollows.communities =
              updatedFollows.communities?.filter((community) => community.slug !== slug) || []
          }
          break
        }
        // case 'AUTHOR': {
        default: {
          if (value) {
            if (!updatedFollows.authors?.some((author) => author.slug === slug)) {
              updatedFollows.authors = [...(updatedFollows.authors || []), { slug } as Author]
            }
          } else {
            updatedFollows.authors = updatedFollows.authors?.filter((author) => author.slug !== slug) || []
          }
          break
        }
      }
      return updatedFollows
    })

    try {
      if (value) {
        follow(what, slug)
      } else {
        unfollow(what, slug)
      }
    } catch (error) {
      console.error(error)
    } finally {
      fetchData()
    }
  }

  const value: FollowingContextType = {
    loading,
    follows,
    setFollows,
    changeFollowing,
    followers,
    loadFollows: fetchData,
    follow,
    unfollow
  }

  return <FollowingContext.Provider value={value}>{props.children}</FollowingContext.Provider>
}
