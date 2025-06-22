import { Params, RouteSectionProps } from '@solidjs/router'
import { createEffect, createMemo, createResource, createSignal, on, Show } from 'solid-js'
import { Loading } from '~/components/_shared/Loading'
import { LoadMoreItems, LoadMoreWrapper } from '~/components/_shared/LoadMoreWrapper'
import { PageLayout } from '~/components/_shared/PageLayout'
import { TopicsNav } from '~/components/HeaderNav/TopicsNav'
import { Expo, ExpoNav } from '~/components/Views/ExpoView'
import { EXPO_LAYOUTS, EXPO_TITLES, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { loadShouts } from '~/graphql/api/public'
import { Shout } from '~/graphql/schema/core.gen'
import { ExpoLayoutType } from '~/types/nav'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'

const SHOUTS_PER_PAGE = 24

const fetchExpoShouts = async (layouts: string[], offset = 0) => {
  const fetcher = loadShouts({ options: { filters: { layouts }, limit: SHOUTS_PER_PAGE, offset } })
  const result = await fetcher()
  return result
}

export const route = {
  load: async ({ params }: { params: Params }) => {
    const layouts: string[] = params.layout ? [params.layout] : [...EXPO_LAYOUTS]
    return await fetchExpoShouts(layouts)
  }
}

export default (props: RouteSectionProps<Shout[]>) => {
  const { t } = useLocalize()
  const { feedByLayout, addShoutsToFeed } = useFeed()
  const [loadMoreVisible, setLoadMoreVisible] = createSignal(true)
  const getTitle = createMemo(() => (l?: string) => EXPO_TITLES[(l as ExpoLayoutType) || ''])

  const [currentLayout, setCurrentLayout] = createSignal<ExpoLayoutType>(
    (props.params.layout || '') as ExpoLayoutType
  )
  const [feed, setFeed] = createSignal<Shout[]>([])

  createEffect(() => {
    if (props.params.layout !== currentLayout()) {
      setFeed([])
      setCurrentLayout((props.params.layout || '') as ExpoLayoutType)
    }
  })

  const [shouts] = createResource(
    () => ({ layout: currentLayout() }),
    async ({ layout }) => {
      const layouts = layout ? [layout] : EXPO_LAYOUTS
      const existingFeed = layout ? feedByLayout()[layout] : []

      if (existingFeed?.length >= SHOUTS_PER_PAGE) {
        return existingFeed
      }

      const result = await fetchExpoShouts(layouts)
      if (result?.length) {
        addShoutsToFeed(result)
      }
      return result || props.data || []
    },
    {
      initialValue: props.data
    }
  )

  createEffect(
    on(
      () => shouts() || [],
      (newShouts: Shout[]) => {
        if (newShouts?.length) {
          const uniqueShouts = newShouts.filter(
            (shout, index, self) => index === self.findIndex((s) => s.slug === shout.slug)
          )
          setFeed(uniqueShouts)
          setLoadMoreVisible(uniqueShouts.length >= SHOUTS_PER_PAGE)
        }
      }
    )
  )

  const loadMore = async () => {
    saveScrollPosition()
    const layout = currentLayout()
    const offset = feed().length

    try {
      const result = await fetchExpoShouts(layout ? [layout] : EXPO_LAYOUTS, offset)

      if (result?.length) {
        const currentSlugs = new Set(feed().map((s) => s.slug))
        const newShouts = result.filter((shout) => !currentSlugs.has(shout.slug))

        if (newShouts.length) {
          addShoutsToFeed(newShouts)
          setFeed((prev) => [...prev, ...newShouts])
          setLoadMoreVisible(result.length >= SHOUTS_PER_PAGE)
        } else {
          setLoadMoreVisible(false)
        }
      } else {
        setLoadMoreVisible(false)
      }

      restoreScrollPosition()
      return result as LoadMoreItems
    } catch (error) {
      console.error('Error loading more shouts', error)
      setLoadMoreVisible(false)
      return []
    }
  }

  return (
    <PageLayout
      withPadding={true}
      zeroBottomPadding={true}
      title={`${t('Discours')} :: ${getTitle()(currentLayout())}`}
    >
      <Show when={!shouts.loading} fallback={<Loading />}>
        <Show when={!shouts.error} fallback={<div>Error: {shouts.error?.message}</div>}>
          <TopicsNav />
          <ExpoNav layout={currentLayout()} />
          <LoadMoreWrapper loadFunction={loadMore} pageSize={SHOUTS_PER_PAGE} hidden={!loadMoreVisible()}>
            <Expo shouts={feed()} layout={currentLayout()} />
          </LoadMoreWrapper>
        </Show>
      </Show>
    </PageLayout>
  )
}
