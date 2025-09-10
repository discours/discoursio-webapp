import { RouteDefinition, RouteSectionProps, useLocation } from '@solidjs/router'
import { HttpStatusCode } from '@solidjs/start'
import {
  createEffect,
  createResource,
  createSignal,
  ErrorBoundary,
  Match,
  on,
  onMount,
  Show,
  Suspense,
  Switch
} from 'solid-js'
import { Loading } from '~/components/_shared/Loading'
import { FourOuFourView } from '~/components/Views/FourOuFour'
import { gaIdentity } from '~/config'
import { useLocalize } from '~/context/localize'
import { getAuthor, getShout, loadShouts, loadTopicAuthors, loadTopicBySlug, loadTopics } from '~/graphql/api/public'
import type { Author, Reaction, Shout, Topic } from '~/graphql/generated/graphql'
import { initGA, loadGAScript } from '~/utils/ga'
import { descFromBody, keywordsFromTopics } from '~/utils/meta'
import { PageLayout } from '../../components/_shared/PageLayout'
import { FullArticle } from '../../components/Article/FullArticle'
import { ReactionsProvider } from '../../context/reactions'
import AuthorPage, { AuthorPageProps } from '../author/[slug]/[...mode]'
import TopicPage, { TopicPageProps } from '../topic/[slug]/[...mode]'

// ✨ Служебные пути, которые не являются статьями
const SKIP_PATHS = ['fonts', 'icons', 'api', 'robots.txt', 'favicon.ico', 'manifest.json', 'sw.js']

const isSkippedPath = (slug: string): boolean => {
  return slug.startsWith('_') || slug.startsWith('.') || SKIP_PATHS.includes(slug)
}

const fetchShout = async (slug: string): Promise<Shout | undefined> => {
  if (isSkippedPath(slug)) {
    return
  }

  console.log(`[fetchShout] Loading article for slug: "${slug}"`)
  try {
    const shoutLoader = getShout({ slug })

    // Добавляем таймаут для запроса
    const timeoutPromise = new Promise<undefined>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 15000)
    })

    const result = await Promise.race([shoutLoader(), timeoutPromise])

    console.log(`[fetchShout] Result for "${slug}":`, {
      hasResult: !!result,
      title: result?.title,
      id: result?.id,
      hasAuthors: !!result?.authors?.length,
      hasTopics: !!result?.topics?.length
    })
    return result
  } catch (error) {
    console.error(`[fetchShout] Error loading "${slug}":`, error)
    return
  }
}

export const route: RouteDefinition = {
  load: async ({ params }) => {
    // ✅ Валидация slug параметра
    if (!params.slug || params.slug === 'undefined') {
      console.warn('[ArticleRoute] Invalid slug:', params.slug)
      return { article: undefined, topics: undefined }
    }

    if (isSkippedPath(params.slug)) {
      return { article: undefined, topics: undefined }
    }

    console.log(`[ArticleRoute] SSR loading for slug: "${params.slug}"`)

    try {
      // ✅ Обработка тем (!topic-slug)
      if (params.slug.startsWith('!')) {
        const topicSlug = params.slug.slice(1) // Убираем !
        console.log(`[ArticleRoute] Loading topic data for: "${topicSlug}"`)

        const [topic, topics, authors] = await Promise.all([
          loadTopicBySlug(topicSlug)(),
          loadTopics(),
          loadTopicAuthors({ slug: topicSlug })()
        ])

        const articles = await loadShouts({
          options: {
            filters: { topic: topicSlug },
            limit: 20,
            offset: 0
          }
        })()

        console.log('[ArticleRoute] Topic data loaded:', {
          topic: topic?.title,
          articlesCount: articles?.length || 0,
          authorsCount: authors?.length || 0
        })

        return {
          article: undefined,
          topics: topics || [],
          topic,
          authors,
          articles
        }
      }

      // ✅ Обработка авторов (@author-slug)
      if (params.slug.startsWith('@')) {
        const authorSlug = params.slug.slice(1) // Убираем @
        console.log(`[ArticleRoute] Loading author data for: "${authorSlug}"`)

        const [author, topics, articles] = await Promise.all([
          getAuthor({ slug: authorSlug })(),
          loadTopics(),
          loadShouts({
            options: {
              filters: { author: authorSlug },
              limit: 20,
              offset: 0
            }
          })()
        ])

        console.log('[ArticleRoute] Author data loaded:', {
          author: author?.name,
          articlesCount: articles?.length || 0
        })

        return {
          article: undefined,
          topics: topics || [],
          author,
          articles
        }
      }

      // ✅ Обработка обычных статей
      // If this is a topic route (starts with !), preload topics data
      let topics: Topic[] | undefined
      if (params.slug.startsWith('!')) {
        const topicsLoader = loadTopics()
        topics = await topicsLoader()
      }

      // Загружаем статью с таймаутом
      const articlePromise = fetchShout(params.slug)
      const timeoutPromise = new Promise<undefined>((_, reject) => {
        setTimeout(() => reject(new Error('SSR timeout')), 10000)
      })

      const article = await Promise.race([articlePromise, timeoutPromise])

      console.log('[ArticleRoute] SSR loaded article:', {
        slug: params.slug,
        hasArticle: !!article,
        title: article?.title,
        id: article?.id
      })

      return {
        article,
        topics
      }
    } catch (error) {
      console.error(`[ArticleRoute] SSR error for slug "${params.slug}":`, error)

      // Возвращаем пустые данные вместо ошибки
      return {
        article: undefined,
        topics: undefined
      }
    }
  }
}

export type ArticlePageProps = {
  article?: Shout
  comments?: Reaction[]
  votes?: Reaction[]
  author?: Author
  topics?: Topic[]
  topic?: Topic
  authors?: Author[]
  articles?: Shout[]
}

export type SlugPageProps = {
  article?: Shout
  comments?: Reaction[]
  votes?: Reaction[]
  author?: Author
  topics?: Topic[]
  topic?: Topic
  authors?: Author[]
  articles?: Shout[]
}

function ArticlePageContent(props: RouteSectionProps<ArticlePageProps>) {
  const loc = useLocation()
  const { t } = useLocalize()

  // Используем SSR данные напрямую, createResource только для клиентских обновлений
  const [clientData] = createResource(
    () => {
      // ✨ Фильтруем служебные пути
      if (isSkippedPath(props.params.slug)) {
        return null
      }

      // Запускаем загрузку только если нет SSR данных
      if (!props.data?.article) {
        console.log(`[ArticlePageContent] No SSR data for "${props.params.slug}", fetching on client`)
        return props.params.slug
      }
      return null
    },
    async (slug) => {
      if (!slug) return undefined

      console.log(`[ArticlePageContent] Fetching for "${slug}"`)

      // Retry логика для клиентской загрузки
      let retries = 3
      while (retries > 0) {
        try {
          const result = await fetchShout(slug)
          if (result) {
            console.log(`[ArticlePageContent] Successfully loaded "${slug}" on attempt ${4 - retries}`)
            return result
          }
        } catch (error) {
          console.warn(`[ArticlePageContent] Attempt ${4 - retries} failed for "${slug}":`, error)
        }

        retries--
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      console.error(`[ArticlePageContent] Failed to load "${slug}" after 3 attempts`)
      return undefined
    }
  )

  // Приоритет: SSR данные > клиентские данные
  const articleData = () => props.data?.article || clientData()

  onMount(async () => {
    if (gaIdentity && articleData()?.id) {
      try {
        await loadGAScript(gaIdentity)
        initGA(gaIdentity)
      } catch (error) {
        console.warn('[routes] [slug]/[...mode] Failed to connect Google Analytics:', error)
      }
    }
  })

  createEffect(
    on(
      articleData,
      (a?: Shout) => {
        if (!a?.id) return
        window?.gtag?.('event', 'page_view', {
          page_title: a.title,
          page_location: window?.location.href || '',
          page_path: loc.pathname
        })
      },
      { defer: true }
    )
  )

  // dufok added article in PageLayout props for OG image generation

  // Диагностика данных статьи
  createEffect(() => {
    console.log('[ArticlePageContent] Article data state:', {
      slug: props.params.slug,
      hasSSRData: !!props.data?.article,
      hasClientData: !!clientData(),
      finalData: !!articleData(),
      title: articleData()?.title,
      id: articleData()?.id
    })
  })

  return (
    <Suspense fallback={<Loading />}>
      <ReactionsProvider>
        <PageLayout
          title={`${t('Discours')}${articleData()?.title ? ' :: ' : ''}${articleData()?.title || props.params.slug}`}
          desc={descFromBody(articleData()?.body || '')}
          keywords={keywordsFromTopics((articleData()?.topics || []) as { title: string }[])}
          headerTitle={articleData()?.title || props.params.slug}
          slug={articleData()?.slug || props.params.slug}
          cover={articleData()?.cover || ''}
          article={articleData()}
        >
          <Show when={articleData()} fallback={<Loading />}>
            <FullArticle article={articleData()!} />
          </Show>
        </PageLayout>
      </ReactionsProvider>
    </Suspense>
  )
}

export default function ArticlePage(props: RouteSectionProps<SlugPageProps>) {
  const [currentSlug, setCurrentSlug] = createSignal(props.params.slug)
  createEffect(() => {
    const newSlug = props.params.slug
    if (newSlug !== currentSlug()) {
      setCurrentSlug(newSlug)
    }
  })

  // console.log('[ArticlePage] props:', props)

  return (
    <Switch>
      <Match when={currentSlug().startsWith('@')}>
        <AuthorPage
          {...({
            ...props,
            params: {
              ...props.params,
              slug: currentSlug().slice(1)
            },
            data: {
              ...props.data,
              author: props.data?.author,
              articles: props.data?.articles || [],
              topics: props.data?.topics || []
            }
          } as RouteSectionProps<AuthorPageProps>)}
        />
      </Match>
      <Match when={currentSlug().startsWith('!')}>
        <TopicPage
          {...({
            ...props,
            params: {
              ...props.params,
              slug: currentSlug().slice(1)
            },
            data: {
              ...props.data,
              topics: props.data?.topics || [],
              topic: props.data?.topic,
              authors: props.data?.authors || [],
              articles: props.data?.articles || []
            }
          } as RouteSectionProps<TopicPageProps>)}
        />
      </Match>
      <Match when={!['@', '!'].some((prefix) => currentSlug().startsWith(prefix))}>
        <ArticlePageContent {...props} />
      </Match>
      <Match when={true}>
        <ErrorBoundary fallback={() => <HttpStatusCode code={404} />}>
          <FourOuFourView />
        </ErrorBoundary>
      </Match>
    </Switch>
  )
}
