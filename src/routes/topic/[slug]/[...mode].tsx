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
      console.log(`[TopicRoute] Loaded articles for "${params.slug}":`, {
        hasArticles: !!articles,
        articlesCount: articles?.length || 0,
        firstArticle: articles?.[0]?.title
      })

      // Load topic
      const topic = await loadTopicBySlug(params.slug)()

      // Временная отладка загрузки топика
      console.log(`[TopicRoute] Loaded topic "${params.slug}":`, {
        found: !!topic,
        title: topic?.title,
        hasStat: !!topic?.stat,
        stat: topic?.stat
      })

      const result = {
        articles,
        topic
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

  // Define route data accessor FIRST
  const routeData = () => props.data

  // 🔧 ПРОСТОЕ РЕШЕНИЕ: Прямой доступ к данным из route.load через сигнал
  const [currentTopic, setCurrentTopic] = createSignal<Topic | undefined>()

  // 🔧 ПРАВИЛЬНЫЙ ПАТТЕРН: Используем createResource для работы с Promise из route.load
  const [resolvedData] = createResource(
    () => routeData(),
    async (data) => {
      console.log('[TopicRoute] Resolving route data:', {
        hasData: !!data,
        dataType: typeof data,
        isPromise: data instanceof Promise
      })

      // Если это Promise, ждем разрешения
      const resolved = data instanceof Promise ? await data : data

      console.log('[TopicRoute] Resolved route data:', {
        hasResolved: !!resolved,
        hasTopic: !!resolved?.topic,
        topicTitle: resolved?.topic?.title,
        topicStat: resolved?.topic?.stat
      })

      return resolved
    }
  )

  // Устанавливаем топик когда данные разрешились
  createEffect(() => {
    const data = resolvedData()
    if (data?.topic) {
      console.log('[TopicRoute] Setting currentTopic:', data.topic.title)
      setCurrentTopic(data.topic)
    }
  })

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
        // 🔧 ПРОСТОЕ РЕШЕНИЕ: Сначала проверяем resolvedData
        const resolved = resolvedData()
        if (resolved?.articles) {
          console.log('[TopicRoute] Using resolved articles:', resolved.articles.length)
          return resolved.articles
        }

        // 🔧 FALLBACK: Если нет resolved данных, используем props.data
        const data = routeData()
        if (data?.articles) {
          console.log('[TopicRoute] Using route.load articles:', data.articles.length)
          return data.articles
        }

        console.log(`[TopicRoute] No route data, fetching articles for "${slug}"`)
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
      // 🔧 КРИТИЧНО: initialValue должен быть массивом для стабильной гидрации
      initialValue: [],
      ssrLoadFrom: 'initial'
    }
  )

  // current topic's data - initialize empty, will be set when route data loads
  const [title, setTitle] = createSignal<string>('')
  const [desc, setDesc] = createSignal<string>('')
  const [cover, setCover] = createSignal<string>('/logo.png')
  const [viewed, setViewed] = createSignal(false)
  const [topicsAdded, setTopicsAdded] = createSignal(false)

  // 🔧 Установка мета-данных страницы при наличии топика
  createEffect(() => {
    const topic = currentTopic()
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
  })

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
      <Show when={!articles.loading && !resolvedData.loading} fallback={<Loading />}>
        <Show
          when={!articles.error && !resolvedData.error}
          fallback={<div>Error: {articles.error?.message || resolvedData.error?.message}</div>}
        >
          <PageLayout key="topic" title={title()} desc={desc()} cover={cover()} topic={currentTopic() as Topic}>
            <TopicView
              topic={currentTopic() as Topic}
              shouts={articles() || resolvedData()?.articles || []}
              topicSlug={props.params.slug}
            />
          </PageLayout>
        </Show>
      </Show>
    </Show>
  )
}
