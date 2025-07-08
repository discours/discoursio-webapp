import type { JSX } from 'solid-js'
import {
  Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
  Setter,
  useContext
} from 'solid-js'
import { RANDOM_TOPIC_SHOUTS_COUNT } from '~/constants/pagination'
import { loadShouts } from '~/graphql/api/public'
import { Shout, Topic } from '~/graphql/generated/graphql'
import { byStat } from '../utils/sort'
import { FEED_PAGE_SIZE } from './feed'
import { useTopics } from './topics'

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
  randomTopicFeed: Accessor<{ shouts: Shout[]; topic: Topic } | undefined>
  setRandomTopicFeed: Setter<{ shouts: Shout[]; topic: Topic } | undefined>
}

const FeaturedFeedContext = createContext<FeaturedFeedContextType>({} as FeaturedFeedContextType)

export const useFeaturedFeed = () => useContext(FeaturedFeedContext)

export const FeaturedFeedProvider = (props: { children: JSX.Element }) => {
  const [featuredFeed, setFeaturedFeed] = createSignal<Shout[] | undefined>([])
  const [topMonthFeed, setTopMonthFeed] = createSignal<Shout[] | undefined>([])
  const [topFeed, setTopFeed] = createSignal<Shout[] | undefined>([])
  const [topCommentedFeed, setTopCommentedFeed] = createSignal<Shout[] | undefined>([])
  const [randomTopicFeed, setRandomTopicFeed] = createSignal<
    { shouts: Shout[]; topic: Topic } | undefined
  >()
  const { randomTopic } = useTopics()

  createEffect(
    on(
      randomTopic,
      async (t?: Topic) => {
        const shoutsLoader = await loadShouts({
          options: {
            filters: { topic: t?.slug, featured: true },
            limit: RANDOM_TOPIC_SHOUTS_COUNT,
            offset: 0
          }
        })
        const shouts = await shoutsLoader()
        setRandomTopicFeed({ shouts, topic: t as Topic })
      },
      {}
    )
  )

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
        setTopCommentedFeed,
        randomTopicFeed,
        setRandomTopicFeed
      }}
    >
      {props.children}
    </FeaturedFeedContext.Provider>
  )
}
