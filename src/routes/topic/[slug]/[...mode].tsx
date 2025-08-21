import { RouteSectionProps } from '@solidjs/router'
import { HttpStatusCode } from '@solidjs/start'
import { createEffect, createResource, createSignal, on, Show } from 'solid-js'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { FourOuFourView } from '~/components/Views/FourOuFour'
import { TopicView } from '~/components/Views/TopicView'
import { FEED_PAGE_SIZE } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useTopics } from '~/context/topics'
import { loadShouts, loadTopicBySlug } from '~/graphql/api/public'
import { Author, LoadShoutsOptions, Shout, Topic } from '~/graphql/generated/graphql'
import { getFileUrl } from '~/lib/imageCache'
import { descFromBody } from '~/utils/meta'

const fetchTopicShouts = async (slug: string, offset?: number) => {
  const options: LoadShoutsOptions = { filters: { topic: slug }, limit: FEED_PAGE_SIZE, offset }
  const shoutsLoader = loadShouts({ options })
  return await shoutsLoader()
}

export const route = {
  load: async ({ params, location: { query } }: RouteSectionProps<{ articles: Shout[]; topic: Topic }>) => {
    const offset: number = Number.parseInt(query.offset as string, 10)

    try {
      // Load articles
      const articles = await fetchTopicShouts(params.slug, offset)

      // Load topic
      const topic = await loadTopicBySlug(params.slug)()

      return {
        articles,
        topic
      }
    } catch (error) {
      console.error('Error in topic route loader:', error)
      return {
        articles: [],
        topic: null
      }
    }
  }
}
export type TopicPageProps = { articles?: Shout[]; topic?: Topic; topics?: Topic[]; authors?: Author[] }

export default function TopicPage(props: RouteSectionProps<TopicPageProps>) {
  const { t } = useLocalize()

  // all topics
  const { addTopics, sortedTopics } = useTopics()
  const [loadingError, setLoadingError] = createSignal(false)

  // Initialize topics from preloaded data if available
  createEffect(() => {
    if (props.data?.topics && props.data.topics.length > 0) {
      addTopics(props.data.topics)
    }
  })

  // Use preloaded topic data immediately, fallback to context
  const [currentTopic, setCurrentTopic] = createSignal<Topic | undefined>()

  // Define route data accessor FIRST
  const routeData = () => props.data

  // Initialize topic data from route loader
  createEffect(() => {
    const data = routeData()

    if (data?.topic) {
      setCurrentTopic(data.topic)
      setTitle(`${t('Discours')} :: ${data.topic.title}`)
      setDesc(
        data.topic.body
          ? descFromBody(data.topic.body)
          : t('The most interesting publications on the topic', { topicName: data.topic.title })
      )
      setCover(data.topic.pic ? getFileUrl(data.topic.pic, { width: 1200 }) : '/logo.png')
    }
  })

  // current topic's shouts - get initial data from route

  const [articles] = createResource(
    () => props.params.slug,
    async (slug) => {
      try {
        const data = routeData()
        if (data?.articles) {
          return data.articles
        }
        const result = await fetchTopicShouts(slug)
        if (!result) {
          setLoadingError(true)
        }
        return result
      } catch (error) {
        console.error('Error loading topic shouts:', error)
        setLoadingError(true)
        return []
      }
    },
    {
      initialValue: routeData()?.articles,
      ssrLoadFrom: 'initial'
    }
  )

  // current topic's data - initialize empty, will be set when route data loads
  const [title, setTitle] = createSignal<string>('')
  const [desc, setDesc] = createSignal<string>('')
  const [cover, setCover] = createSignal<string>('/logo.png')
  const [viewed, setViewed] = createSignal(false)
  const [topicsAdded, setTopicsAdded] = createSignal(false)

  createEffect(
    on(
      sortedTopics,
      (ttt) => {
        if (ttt && !topicsAdded()) {
          addTopics(ttt)
          setTopicsAdded(true)
          const tpc = ttt.find((x) => x.slug === props.params.slug)

          if (!tpc) return

          // Update current topic if not already set from preloaded data
          if (!currentTopic()) {
            setCurrentTopic(tpc)
            setTitle(`${t('Discours')}${tpc.title ? ` :: ${tpc.title}` : ''}`)
            setDesc(
              tpc.body
                ? descFromBody(tpc.body)
                : t('The most interesting publications on the topic', { topicName: tpc.title })
            )
            setCover(tpc.pic ? getFileUrl(tpc.pic, { width: 1200 }) : '/logo.png')
          }

          if (!viewed()) {
            const topic = currentTopic()
            if (topic) {
              window?.gtag?.('event', 'page_view', {
                page_title: topic.title,
                page_location: window.location.href,
                page_path: window.location.pathname
              })
              setViewed(true)
            }
          }
        }
      },
      { defer: true }
    )
  )

  return (
    <Show
      when={!loadingError()}
      fallback={
        <PageLayout isHeaderFixed={false} hideFooter={true} title={t('Nothing is here')}>
          <FourOuFourView />
          <HttpStatusCode code={404} />
        </PageLayout>
      }
    >
      <Show when={!articles.loading && articles()} fallback={<Loading />}>
        <Show when={!articles.error} fallback={<div>Error: {articles.error?.message}</div>}>
          <PageLayout key="topic" title={title()} desc={desc()} cover={cover()} topic={currentTopic() as Topic}>
            <TopicView topic={currentTopic() as Topic} shouts={articles() || []} topicSlug={props.params.slug} />
          </PageLayout>
        </Show>
      </Show>
    </Show>
  )
}
