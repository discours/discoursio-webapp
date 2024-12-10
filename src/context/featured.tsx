import { Accessor, Setter, createContext, createMemo, createSignal, useContext } from 'solid-js'
import type { JSX } from 'solid-js'
import { Shout } from '~/graphql/schema/core.gen'
import { byStat } from '../utils/sort'
import { FEED_PAGE_SIZE } from './feed'

type FeaturedFeedContextType = {
  featuredFeed: Accessor<Shout[] | undefined>
  setFeaturedFeed: Setter<Shout[] | undefined>
  topMonthFeed: Accessor<Shout[] | undefined>
  setTopMonthFeed: Setter<Shout[] | undefined>
  topFeed: Accessor<Shout[] | undefined>
  setTopFeed: Setter<Shout[] | undefined>
  topViewedFeed: Accessor<Shout[] | undefined>
  topCommentedFeed: Accessor<Shout[] | undefined>
  setTopCommentedFeed: Setter<Shout[] | undefined>
}

const FeaturedFeedContext = createContext<FeaturedFeedContextType>({} as FeaturedFeedContextType)

export const useFeaturedFeed = () => useContext(FeaturedFeedContext)

export const FeaturedFeedProvider = (props: { children: JSX.Element }) => {
  const [featuredFeed, setFeaturedFeed] = createSignal<Shout[] | undefined>([])
  const [topMonthFeed, setTopMonthFeed] = createSignal<Shout[] | undefined>([])
  const [topFeed, setTopFeed] = createSignal<Shout[] | undefined>([])
  const [topCommentedFeed, setTopCommentedFeed] = createSignal<Shout[] | undefined>([])

  const topViewedFeed = createMemo(() => {
    const feed = featuredFeed()
    if (!feed?.length) return []
    return [...feed].sort(byStat('viewed') as (a: Shout, b: Shout) => number).slice(0, FEED_PAGE_SIZE)
  })

  return (
    <FeaturedFeedContext.Provider
      value={{
        featuredFeed,
        setFeaturedFeed,
        topMonthFeed,
        setTopMonthFeed,
        topFeed,
        setTopFeed,
        topViewedFeed,
        topCommentedFeed,
        setTopCommentedFeed
      }}
    >
      {props.children}
    </FeaturedFeedContext.Provider>
  )
}
