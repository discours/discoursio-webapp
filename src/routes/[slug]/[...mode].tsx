import { RouteDefinition, RouteSectionProps, useLocation } from '@solidjs/router'
import { HttpStatusCode } from '@solidjs/start'
import {
  ErrorBoundary,
  Match,
  Show,
  Suspense,
  Switch,
  createEffect,
  createResource,
  createSignal,
  on,
  onMount
} from 'solid-js'
import { FourOuFourView } from '~/components/Views/FourOuFour'
import { Loading } from '~/components/_shared/Loading'
import { gaIdentity } from '~/config'
import { useLocalize } from '~/context/localize'
import { getShout, loadTopics } from '~/graphql/api/public'
import type { Author, Reaction, Shout, Topic } from '~/graphql/schema/core.gen'
import { initGA, loadGAScript } from '~/utils/ga'
import { descFromBody, keywordsFromTopics } from '~/utils/meta'
import { FullArticle } from '../../components/Article/FullArticle'
import { PageLayout } from '../../components/_shared/PageLayout'
import { ReactionsProvider } from '../../context/reactions'
import AuthorPage, { AuthorPageProps } from '../author/[slug]/[...mode]'
import TopicPage, { TopicPageProps } from '../topic/[slug]/[...mode]'

const fetchShout = async (slug: string): Promise<Shout | undefined> => {
  if (slug.startsWith('@') || slug.startsWith('!') || slug.startsWith('_') || slug.startsWith('.')) return
  // console.log('[fetchShout] slug:', slug)
  try {
    const shoutLoader = getShout({ slug })
    const result = await shoutLoader()
    //console.log('[fetchShout] result:', result)
    return result
  } catch (error) {
    console.error('[fetchShout] error:', error)
    return
  }
}

export const route: RouteDefinition = {
  load: async ({ params }) => {
    // If this is a topic route (starts with !), preload topics data
    let topics: Topic[] | undefined
    if (params.slug.startsWith('!')) {
      const topicsLoader = loadTopics()
      topics = await topicsLoader()
    }

    const article = await fetchShout(params.slug)
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
      if (props.data?.article) {
        return props.data.article
      }
      const result = await fetchShout(slug)
      return result
    },
    {
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

  return (
    <Suspense fallback={<Loading />}>
      <Show when={data()} fallback={<FourOuFourView />}>
        <ReactionsProvider>
          <PageLayout
            title={`${t('Discours')}${data()?.title ? ' :: ' : ''}${data()?.title || ''}`}
            desc={descFromBody(data()?.body || '')}
            keywords={keywordsFromTopics((data()?.topics || []) as { title: string }[])}
            headerTitle={data()?.title || ''}
            slug={data()?.slug}
            cover={data()?.cover || ''}
            article={data()}
          >
            <FullArticle article={data()!} />
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
    <Switch fallback={<div>Loading...</div>}>
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
