import { Accessor, Setter, createContext, createMemo, createSignal, useContext } from 'solid-js'
import type { JSX } from 'solid-js'
import { loadShouts } from '~/graphql/api/public'
import { LoadShoutsOptions, Shout } from '~/graphql/schema/core.gen'
import { byStat } from '../utils/sort'

type FeaturedFeedContextType = {
  featuredFeed: Accessor<Shout[] | undefined>
  setFeaturedFeed: Setter<Shout[] | undefined>
  topMonthFeed: Accessor<Shout[] | undefined>
  loadTopMonthFeed: () => Promise<void>
  topFeed: Accessor<Shout[] | undefined>
  loadTopFeed: () => Promise<void>
  topViewedFeed: Accessor<Shout[] | undefined>
  topCommentedFeed: Accessor<Shout[] | undefined>
}

const FeaturedFeedContext = createContext<FeaturedFeedContextType>({} as FeaturedFeedContextType)

export const useFeaturedFeed = () => useContext(FeaturedFeedContext)

export const FeaturedFeedProvider = (props: { children: JSX.Element }) => {
  const [featuredFeed, setFeaturedFeed] = createSignal<Shout[] | undefined>([])
  const [topMonthFeed, setTopMonthFeed] = createSignal<Shout[] | undefined>([])
  const [topFeed, setTopFeed] = createSignal<Shout[] | undefined>([])

  const loadTopMonthFeed = async (): Promise<void> => {
    const daysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const after = Math.floor(daysAgo / 1000)
    const options = {
      filters: {
        featured: true,
        after
      },
      order_by: 'rating' as const,
      limit: 10
    } as LoadShoutsOptions
    try {
      const fetcher = await loadShouts({ options })
      const result = (await fetcher()) || []
      setTopMonthFeed(result)
    } catch (error) {
      console.error('Ошибка при загрузке топовых статей за месяц:', error)
    }
  }

  const loadTopFeed = async (): Promise<void> => {
    const options = {
      filters: { featured: true },
      limit: 10
    }
    try {
      const fetcher = await loadShouts({ options })
      const result = (await fetcher()) || []
      setTopFeed(result)
    } catch (error) {
      console.error('Ошибка при загрузке топовых статей:', error)
    }
  }

  // Мемоизированные топовые по просмотрам статьи
  const topViewedFeed = createMemo(() =>
    [...(featuredFeed() || [])].sort(byStat('viewed') as (a: Shout, b: Shout) => number)
  )

  // Мемоизированные топовые по комментариям статьи
  const topCommentedFeed = createMemo(() =>
    [...(featuredFeed() || [])].sort(byStat('commented') as (a: Shout, b: Shout) => number)
  )

  return (
    <FeaturedFeedContext.Provider
      value={{
        featuredFeed,
        setFeaturedFeed,
        topMonthFeed,
        loadTopMonthFeed,
        topFeed,
        loadTopFeed,
        topViewedFeed,
        topCommentedFeed
      }}
    >
      {props.children}
    </FeaturedFeedContext.Provider>
  )
}
