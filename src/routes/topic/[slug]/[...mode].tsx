import { RouteSectionProps, useParams } from '@solidjs/router'
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
    const offset: number = Number.parseInt(query.offset as string, 10) || 0

    // ✅ Валидация slug параметра
    if (!params.slug || params.slug === 'undefined') {
      console.warn('[TopicRoute] Invalid slug:', params.slug)
      return {
        articles: [],
        topic: null,
        authors: []
      }
    }

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

  // ✅ Получаем актуальный slug из URL параметров
  const params = useParams()
  const currentSlug = () => params.slug || props.params.slug

  // Initialize topics from preloaded data if available
  createEffect(() => {
    if (props.data?.topics && props.data.topics.length > 0) {
      addTopics(props.data.topics)
    }
  })

  // Topic мета-данные
  const currentTopic = () => topicData()?.topic

  // ✅ ПРАВИЛЬНО: createResource для клиентского роутинга
  const [topicData] = createResource(
    () => ({ slug: currentSlug(), data: props.data }),
    async ({ slug, data }) => {
      // Для клиентского роутинга загружаем новые данные
      if (slug && slug !== 'undefined') {
        try {
          const [topic, articles, authors] = await Promise.all([
            loadTopicBySlug(slug)(),
            loadShouts({ options: { filters: { topic: slug }, limit: 20, offset: 0 } })(),
            loadTopicAuthors({ slug })()
          ])
          return { topic, articles, authors }
        } catch (error) {
          console.error('[TopicPage] Error loading data:', error)
          return { articles: [], topic: null, authors: [] }
        }
      }

      // Для SSR используем данные из route.load
      const resolved = data instanceof Promise ? await data : data
      return resolved || { articles: [], topic: null, authors: [] }
    },
    {
      initialValue: { articles: [], topic: null, authors: [] }
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
          if (window?.gtag) {
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
          topicSlug={currentSlug()}
          followers={topicData()?.authors || []}
        />
      </PageLayout>
    </Show>
  )
}
