import { Params, RouteSectionProps, createAsync } from '@solidjs/router'
import { Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { TopicsNav } from '~/components/HeaderNav/TopicsNav'
import { Expo, ExpoNav } from '~/components/Views/ExpoView'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { EXPO_LAYOUTS, EXPO_TITLES, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { loadShouts } from '~/graphql/api/public'
import { LoadShoutsFilters, LoadShoutsOptions, Shout } from '~/graphql/schema/core.gen'
import { ExpoLayoutType } from '~/types/common'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'

const SHOUTS_PER_PAGE = 24

const fetchExpoShouts = async (layouts: string[], offset = 0) => {
  const result = await loadShouts({ options: { filters: { layouts }, limit: SHOUTS_PER_PAGE, offset } })
  return result
}

export const route = {
  load: async ({ params }: { params: Params }) => {
    const layouts: string[] = params.layout ? [params.layout] : [...EXPO_LAYOUTS]
    const shoutsLoader = await fetchExpoShouts(layouts)
    return (await shoutsLoader()) as Shout[]
  }
}

export default (props: RouteSectionProps<Shout[]>) => {
  const { t } = useLocalize()
  const { feed, setFeed, feedByLayout } = useFeed()
  const [loadMoreVisible, setLoadMoreVisible] = createSignal(false)
  const getTitle = createMemo(() => (l?: string) => EXPO_TITLES[(l as ExpoLayoutType) || ''])

  const shouts = createAsync(async () => {
    const layouts: string[] = props.params.layout ? [props.params.layout] : [...EXPO_LAYOUTS]
    const fetcher = fetchExpoShouts(layouts)
    const result = (await (await fetcher)()) || []
    return result
  })

  const loadMore = async () => {
    saveScrollPosition()
    const limit = SHOUTS_PER_PAGE
    const layouts: string[] = props.params.layout ? [props.params.layout] : [...EXPO_LAYOUTS]
    const offset = feed()?.length || 0
    const filters: LoadShoutsFilters = { layouts, featured: true }
    const options: LoadShoutsOptions = { filters, limit, offset }
    try {
      const fetcher = await loadShouts({ options })
      const result = (await fetcher()) || []
      setLoadMoreVisible(Boolean(result?.length))
      if (result && Array.isArray(result)) {
        setFeed((prev) => [...prev, ...result])
      }
      restoreScrollPosition()
      return result as LoadMoreItems
    } catch (error) {
      console.log('Error loading more shouts', error)
      return []
    }
  }

  createEffect(
    on(
      () => props.params.layout,
      async (currentLayout) => {
        const layouts: string[] = currentLayout ? [currentLayout] : [...EXPO_LAYOUTS]
        const offset = (currentLayout ? feedByLayout()[currentLayout]?.length : feed()?.length) || 0
        const options: LoadShoutsOptions = {
          filters: { layouts, featured: true },
          limit: SHOUTS_PER_PAGE,
          offset
        }
        const result = await loadShouts({ options })
        if (result && Array.isArray(result)) {
          setFeed(result)
        } else {
          setFeed([])
        }
      }
    )
  )

  return (
    <PageLayout
      withPadding={true}
      zeroBottomPadding={true}
      title={`${t('Discours')} :: ${getTitle()((props.params.layout as ExpoLayoutType) || '')}`}
    >
      <TopicsNav />
      <ExpoNav layout={(props.params.layout as ExpoLayoutType) || ''} />
      <Show when={shouts()} fallback={<Loading />} keyed>
        <LoadMoreWrapper loadFunction={loadMore} pageSize={SHOUTS_PER_PAGE} hidden={!loadMoreVisible()}>
          <Expo shouts={feed() || []} layout={(props.params.layout as ExpoLayoutType) || ''} />
        </LoadMoreWrapper>
      </Show>
    </PageLayout>
  )
}
