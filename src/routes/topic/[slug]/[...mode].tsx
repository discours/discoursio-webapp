import { RouteSectionProps } from '@solidjs/router'
import { createEffect, createResource, createSignal, on, Show } from 'solid-js'
import { Loading } from '~/components/_shared/Loading'
import { PageLayout } from '~/components/_shared/PageLayout'
import { TopicView } from '~/components/Views/TopicView'
import { FEED_PAGE_SIZE } from '~/context/feed'
import { useTopics } from '~/context/topics'
import { loadShouts, loadTopicAuthors, loadTopicBySlug } from '~/graphql/api/public'
import { Author, LoadShoutsOptions, Shout, Topic } from '~/graphql/generated/graphql'
import { getCdnUrl } from '~/lib/imageCache'
// getImageUrl больше не нужен - middleware перехватывает CDN запросы
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
      console.log(`[TopicRoute] Loaded articles for "${params.slug}":`, {
        hasArticles: !!articles,
        articlesCount: articles?.length || 0,
        firstArticle: articles?.[0]?.title
      })

      // Load topic
      const topic = await loadTopicBySlug(params.slug)()

      // ⚡ СРОЧНО: Load authors для SSR
      const authors = await loadTopicAuthors({ slug: params.slug })()

      console.log(`[TopicRoute] Loaded for "${params.slug}":`, {
        articles: articles?.length || 0,
        topic: topic?.title,
        authors: authors?.length || 0
      })

      const result = {
        articles,
        topic,
        authors
      }

      return result
    } catch (error) {
      console.error('Error in topic route loader:', error)
      return {
        articles: [],
        topic: null,
        authors: []
      }
    }
  }
}
export type TopicPageProps = { articles?: Shout[]; topic?: Topic; topics?: Topic[]; authors?: Author[] }

export default function TopicPage(props: RouteSectionProps<TopicPageProps>) {
  // all topics
  const { addTopics } = useTopics()

  // Initialize topics from preloaded data if available
  createEffect(() => {
    if (props.data?.topics && props.data.topics.length > 0) {
      addTopics(props.data.topics)
    }
  })

  // Topic мета-данные
  const currentTopic = () => topicData()?.topic

  // ✅ ПРАВИЛЬНО: createResource для разрешения Promise от route.load
  const [topicData] = createResource(
    () => props.data,
    async (data) => {
      // Разрешаем Promise если это Promise
      const resolved = data instanceof Promise ? await data : data

      console.log('[TopicRoute] Resolved data:', {
        hasArticles: !!resolved?.articles,
        articlesCount: resolved?.articles?.length || 0,
        hasAuthors: !!resolved?.authors,
        authorsCount: resolved?.authors?.length || 0,
        hasTopic: !!resolved?.topic,
        topicTitle: resolved?.topic?.title,
        authorsData: resolved?.authors?.slice(0, 3)?.map((a: Author) => ({ id: a.id, name: a.name })) || 'none'
      })

      return resolved
    },
    {
      // ✅ КРИТИЧНО: initialValue для стабильной гидрации
      initialValue:
        typeof props.data === 'object' && !('then' in props.data)
          ? props.data
          : { articles: [], topic: null, authors: [] } // Fallback структура
    }
  )

  // ✅ Простая функция для получения статей из topicData
  const articles = () => topicData()?.articles || []

  // current topic's meta data - производные от topicData
  const title = () => currentTopic()?.title || ''
  const desc = () => descFromBody(currentTopic()?.body || '')
  const cover = () => getCdnUrl(currentTopic()?.pic) || '/logo.png'
  const [viewed, setViewed] = createSignal(false)

  // ✅ Google Analytics отслеживание
  createEffect(
    on(
      currentTopic,
      (topic) => {
        if (topic && !viewed()) {
          if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', 'page_view', {
              page_title: topic.title,
              page_location: window.location.href,
              page_path: window.location.pathname
            })
          }
          setViewed(true)
        }
      },
      { defer: true }
    )
  )

  return (
    <Show when={topicData()?.topic} fallback={<Loading />}>
      <PageLayout key="topic" title={title()} desc={desc()} cover={cover()} topic={topicData()!.topic}>
        <TopicView
          topic={topicData()!.topic}
          shouts={articles()}
          topicSlug={props.params.slug}
          followers={topicData()?.authors || []}
        />
      </PageLayout>
    </Show>
  )
}
