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
import { isServer } from 'solid-js/web'
import { Loading } from '~/components/_shared/Loading'
import { FourOuFourView } from '~/components/Views/FourOuFour'
import { gaIdentity } from '~/config'
import { useLocalize } from '~/context/localize'
import { getShout, loadTopics } from '~/graphql/api/public'
import type { Author, Reaction, Shout, Topic } from '~/graphql/generated/graphql'
import { initGA, loadGAScript } from '~/utils/ga'
import { descFromBody, keywordsFromTopics } from '~/utils/meta'
import { PageLayout } from '../../components/_shared/PageLayout'
import { FullArticle } from '../../components/Article/FullArticle'
import { ReactionsProvider } from '../../context/reactions'
import AuthorPage, { AuthorPageProps } from '../author/[slug]/[...mode]'
import TopicPage, { TopicPageProps } from '../topic/[slug]/[...mode]'

const fetchShout = async (slug: string): Promise<Shout | undefined> => {
  if (slug.startsWith('@') || slug.startsWith('!') || slug.startsWith('_') || slug.startsWith('.')) {
    console.log(`[fetchShout] Skipping special slug: "${slug}"`)
    return
  }

  console.log(`[fetchShout] Loading article for slug: "${slug}"`)
  try {
    const shoutLoader = getShout({ slug })
    const result = await shoutLoader()
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
    console.log(`[ArticleRoute] SSR loading for slug: "${params.slug}"`)

    // If this is a topic route (starts with !), preload topics data
    let topics: Topic[] | undefined
    if (params.slug.startsWith('!')) {
      const topicsLoader = loadTopics()
      topics = await topicsLoader()
    }

    const article = await fetchShout(params.slug)
    console.log('[ArticleRoute] SSR loaded article:', {
      slug: params.slug,
      hasArticle: !!article,
      title: article?.title,
      id: article?.id
    })

    const data = {
      article,
      topics
    }
    return data
  }
}

export type ArticlePageProps = {
  article?: Shout
  comments?: Reaction[]
  votes?: Reaction[]
  author?: Author
  topics?: Topic[]
}

export type SlugPageProps = {
  article?: Shout
  comments?: Reaction[]
  votes?: Reaction[]
  author?: Author
  topics?: Topic[]
}

function ArticlePageContent(props: RouteSectionProps<ArticlePageProps>) {
  const loc = useLocation()
  const { t } = useLocalize()

  const [data] = createResource(
    () => props.params.slug,
    async (slug) => {
      // 💋 Приоритет SSR данным для OG генерации
      if (props.data?.article) {
        console.log(`[ArticlePageContent] Using SSR data for "${slug}":`, {
          title: props.data.article.title,
          id: props.data.article.id
        })
        return props.data.article
      }

      console.log(`[ArticlePageContent] No SSR data, fetching for "${slug}"`)
      const result = await fetchShout(slug)
      return result
    },
    {
      // 🚨 КРИТИЧНО: initialValue для стабильной гидрации и OG
      initialValue: props.data?.article
    }
  )

  onMount(async () => {
    if (gaIdentity && data()?.id) {
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
      data,
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

  // 🚨 КРИТИЧНО: Используем SSR данные для OG генерации на сервере
  // Приоритет SSR данным, затем клиентским данным
  const articleData = (() => {
    const clientData = data()
    const ssrData = props.data?.article

    // На сервере (для OG) используем SSR данные
    if (isServer && ssrData) {
      console.log(`[ArticlePageContent] Using SSR data for OG: "${ssrData.title}"`)
      return ssrData
    }

    // На клиенте используем загруженные данные или fallback на SSR
    return clientData || ssrData
  })()

  return (
    <Suspense fallback={<Loading />}>
      <Show when={articleData} fallback={<FourOuFourView />}>
        <ReactionsProvider>
          <PageLayout
            title={`${t('Discours')}${articleData?.title ? ' :: ' : ''}${articleData?.title || ''}`}
            desc={descFromBody(articleData?.body || '')}
            keywords={keywordsFromTopics((articleData?.topics || []) as { title: string }[])}
            headerTitle={articleData?.title || ''}
            slug={articleData?.slug}
            cover={articleData?.cover || ''}
            article={articleData}
          >
            <FullArticle article={articleData!} />
          </PageLayout>
        </ReactionsProvider>
      </Show>
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
              topics: props.data?.topics || []
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
