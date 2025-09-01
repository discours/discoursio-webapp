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
import { loadAuthors, loadShouts, loadTopicBySlug } from '~/graphql/api/public'
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
      console.log(`[TopicRoute] Loaded articles for "${params.slug}":`, {
        hasArticles: !!articles,
        articlesCount: articles?.length || 0,
        firstArticle: articles?.[0]?.title
      })

      // Load topic
      const topic = await loadTopicBySlug(params.slug)()

      // ⚡ СРОЧНО: Load authors для SSR
      const authors = await loadAuthors({
        by: { topic: params.slug },
        limit: 20,
        offset: 0
      })()

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

      console.log('[TopicRoute] route.load RETURNING:', {
        hasArticles: !!result.articles,
        articlesCount: result.articles?.length || 0,
        hasTopic: !!result.topic,
        topicTitle: result.topic?.title,
        topicStat: result.topic?.stat,
        fullResult: result
      })

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

  // Define route data accessor FIRST
  const routeData = () => props.data

  // Topic data management
  const [currentTopic, setCurrentTopic] = createSignal<Topic | undefined>()

  // Initialize topic data from route loader using createResource
  const [topicData] = createResource(
    () => routeData(),
    async (data) => {
      console.log('[TopicRoute] Processing route data for topic:', {
        hasData: !!data,
        dataType: typeof data,
        isPromise: data instanceof Promise
      })

      // Если это Promise, ждем разрешения
      const resolved = data instanceof Promise ? await data : data

      console.log('[TopicRoute] Resolved topic data:', {
        hasResolved: !!resolved,
        hasTopic: !!resolved?.topic,
        topicTitle: resolved?.topic?.title
      })

      return resolved
    },
    {
      // Используем SSR данные как initial value
      initialValue: typeof props.data === 'object' && props.data && !('then' in props.data) ? props.data : undefined
    }
  )

  // Устанавливаем топик когда данные готовы (с defer для стабильности)
  createEffect(
    on(
      topicData,
      (resolved) => {
        if (resolved?.topic) {
          console.log('[TopicRoute] Setting currentTopic from resolved data:', resolved.topic.title)
          setCurrentTopic(resolved.topic)
        }
      },
      { defer: true }
    )
  )

  // current topic's shouts - get initial data from route
  const [articles] = createResource(
    () => routeData(),
    async (data) => {
      try {
        console.log('[TopicRoute] createResource called with data:', {
          hasData: !!data,
          dataType: typeof data,
          isPromise: data instanceof Promise,
          hasArticles: data instanceof Promise ? 'pending' : !!data?.articles,
          articlesCount: data instanceof Promise ? 'pending' : data?.articles?.length || 0
        })

        // Если это Promise, ждем разрешения
        const resolved = data instanceof Promise ? await data : data

        console.log('[TopicRoute] Resolved data for articles:', {
          hasResolved: !!resolved,
          hasArticles: !!resolved?.articles,
          articlesCount: resolved?.articles?.length || 0,
          firstArticleTitle: resolved?.articles?.[0]?.title
        })

        // Если есть данные из route.load, используем их
        if (resolved?.articles && resolved.articles.length > 0) {
          console.log('[TopicRoute] Using SSR articles:', resolved.articles.length)
          return resolved.articles
        }

        // Fallback: загружаем с сервера если нет SSR данных
        console.log(`[TopicRoute] No SSR data, fetching articles for "${props.params.slug}"`)
        const result = await fetchTopicShouts(props.params.slug, 0)
        if (!result) {
          setLoadingError(true)
        }
        return result || []
      } catch (error) {
        console.error('Error loading topic shouts:', error)
        setLoadingError(true)
        return []
      }
    },
    {
      // 🔧 КРИТИЧНО: initialValue из SSR данных для стабильной гидрации
      initialValue:
        typeof props.data === 'object' && props.data && !('then' in props.data) ? props.data.articles || [] : [],
      ssrLoadFrom: 'initial'
    }
  )

  // current topic's data - initialize empty, will be set when route data loads
  const [title, setTitle] = createSignal<string>('')
  const [desc, setDesc] = createSignal<string>('')
  const [cover, setCover] = createSignal<string>('/logo.png')
  const [viewed, setViewed] = createSignal(false)
  const [topicsAdded, setTopicsAdded] = createSignal(false)

  // 🔧 Установка мета-данных страницы при наличии топика (с defer)
  createEffect(
    on(
      currentTopic,
      (topic) => {
        if (topic) {
          console.log('[TopicRoute] Setting page meta for topic:', topic.title)
          setTitle(`${t('Discours')} :: ${topic.title}`)
          setDesc(
            topic.body
              ? descFromBody(topic.body)
              : t('The most interesting publications on the topic', { topicName: topic.title })
          )
          setCover(topic.pic ? getFileUrl(topic.pic, { width: 1200 }) : '/logo.png')
        }
      },
      { defer: true }
    )
  )

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
            // Мета-данные устанавливаются в основном createEffect для currentTopic
          }

          if (!viewed()) {
            const topic = currentTopic()
            if (topic) {
              if (window?.gtag) {
                window.gtag('event', 'page_view', {
                  page_title: topic.title,
                  page_location: window.location.href,
                  page_path: window.location.pathname
                })
              }
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
      <Show when={!articles.loading} fallback={<Loading />}>
        <Show when={!articles.error} fallback={<div>Error: {articles.error?.message}</div>}>
          <PageLayout key="topic" title={title()} desc={desc()} cover={cover()} topic={currentTopic() as Topic}>
            <TopicView 
              topic={currentTopic() as Topic} 
              shouts={articles()} 
              topicSlug={props.params.slug}
              followers={routeData()?.authors || []}
            />
          </PageLayout>
        </Show>
      </Show>
    </Show>
  )
}
