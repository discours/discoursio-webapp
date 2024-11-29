/**
 * AuthorPage Component
 *
 * This component is responsible for displaying the author's profile page. It fetches and displays
 * the author's details, their shouts (posts), and comments. It also handles the reactivity of the
 * component when the URL parameters change.
 *
 * Key Features:
 * - Fetches author details, shouts, and comments based on the slug parameter.
 * - Updates the component when the slug parameter changes.
 * - Displays the author's profile, shouts, and comments.
 * - Integrates with Google Analytics to track page views.
 * - Uses SolidJS reactive primitives and hooks for state management and reactivity.
 *
 * Props:
 * - RouteSectionProps<AuthorPageProps>: The properties passed to the component, including the author's data.
 *
 * AuthorPageProps:
 * - articles?: Shout[]
 * - author?: Author
 * - topics?: Topic[]
 * - comments?: Reaction[]
 *
 * Example Usage:
 *
 * ```tsx
 * import AuthorPage from '~/routes/author/[slug]/[...tab]'
 *
 * <AuthorPage params={{ slug: 'author-slug' }} data={{ author: authorData, articles: articlesData }} />
 * ```
 *
 * Dependencies:
 * - SolidJS Router for routing and URL parameter handling.
 * - SolidJS for reactivity and state management.
 * - Various context providers for localization, authors, reactions, etc.
 * - GraphQL API for fetching author details, shouts, comments, and topics.
 *
 * Note:
 * - Ensure that the necessary context providers and GraphQL API functions are properly set up and imported.
 */

import { RouteSectionProps, createAsync, useParams, useSearchParams } from '@solidjs/router'
import {
  ErrorBoundary,
  Show,
  Suspense,
  createEffect,
  createMemo,
  createSignal,
  on,
  onMount
} from 'solid-js'
import { COMMENTS_PER_PAGE } from '~/components/Article/FullArticle'
import { AuthorView } from '~/components/Views/AuthorView'
import { FourOuFourView } from '~/components/Views/FourOuFour'
import { PageLayout } from '~/components/_shared/PageLayout'
import { useAuthors } from '~/context/authors'
import { FEED_PAGE_SIZE, FeedMode, orderByMode, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { ReactionsProvider } from '~/context/reactions'
import { useSession } from '~/context/session'
import { loadAuthors, loadReactions, loadShouts, loadTopics } from '~/graphql/api/public'
import { ReactionKind } from '~/graphql/schema/core.gen'
import {
  Author,
  LoadShoutsOptions,
  QueryLoad_Authors_ByArgs,
  QueryLoad_Reactions_ByArgs,
  Reaction,
  Shout,
  Topic
} from '~/graphql/schema/core.gen'
import { PeriodType, getFromDate } from '~/lib/fromPeriod'
import { getFileUrl } from '~/lib/getThumbUrl'

const fetchAuthorShouts = async (slug: string, offset?: number) => {
  const options: LoadShoutsOptions = { filters: { author: slug }, limit: FEED_PAGE_SIZE, offset }
  const shoutsLoader = loadShouts({ options })
  return await shoutsLoader()
}

const fetchAuthorComments = async (slug: string, offset?: number) => {
  const opts: QueryLoad_Reactions_ByArgs = {
    by: { kinds: [ReactionKind.Comment], author: slug },
    limit: COMMENTS_PER_PAGE,
    offset
  }
  const shoutsLoader = loadReactions(opts)
  return await shoutsLoader()
}

const fetchAllTopics = async () => {
  const topicsFetcher = loadTopics()
  return await topicsFetcher()
}

const fetchAuthor = async (slug: string) => {
  const authorFetcher = loadAuthors({ by: { slug }, limit: 1, offset: 0 } as QueryLoad_Authors_ByArgs)
  const aaa = await authorFetcher()
  return aaa?.[0]
}

export const route = {
  load: async ({ params, location: { query } }: RouteSectionProps<{ articles: Shout[] }>) => {
    const offset: number = Number.parseInt(query.offset as string, 10)
    console.debug('route loading with offset', offset)
    return {
      author: await fetchAuthor(params.slug),
      articles: await fetchAuthorShouts(params.slug, offset),
      topics: await fetchAllTopics()
    }
  }
}

export type AuthorPageProps = {
  articles?: Shout[]
  author?: Author
  topics?: Topic[]
  comments?: Reaction[]
}

export default function AuthorPage(props: RouteSectionProps<AuthorPageProps>) {
  const { t } = useLocalize()
  const params = useParams<{ slug: string; mode: FeedMode | 'comments' | 'about' }>()
  const [searchParams] = useSearchParams<{ period: PeriodType }>()
  const [currentSlug, setCurrentSlug] = createSignal(params.slug)
  const { updateOptions, options } = useFeed()
  const { isSessionLoaded } = useSession()
  const [isClientMounted, setIsClientMounted] = createSignal(false)

  // Add onMount to track client-side hydration
  onMount(() => {
    setIsClientMounted(true)
  })

  // everything from address bar to route feed filters
  createEffect(
    on(
      [() => params.slug, () => params.mode, () => searchParams.period],
      ([newSlug, newMode, newPeriod]) => {
        setCurrentSlug(newSlug)
        const opts: LoadShoutsOptions = { ...options() }

        if (typeof newMode === 'string' && newMode !== 'comments' && newMode !== 'about') {
          opts.order_by = orderByMode(newMode as FeedMode)
        }

        if (newPeriod) {
          opts.filters = {
            ...(opts.filters || {}),
            after: getFromDate(newPeriod as PeriodType)
          }
        }
        updateOptions(opts)
      }
    )
  )

  // load author's profile
  const { addAuthor, authorsEntities } = useAuthors()
  const [author, setAuthor] = createSignal<Author | undefined>(undefined)
  createEffect(
    on(
      author,
      async (profile) => {
        // update only if no profile loaded
        if (!profile) {
          const loadedAuthor =
            authorsEntities()[props.params.slug] || (await fetchAuthor(props.params.slug))
          if (loadedAuthor) {
            addAuthor(loadedAuthor)
            setAuthor(loadedAuthor)
          }
        }
      },
      { defer: true }
    )
  )

  // author's data, view counter
  const [title, setTitle] = createSignal<string>('')
  const [desc, setDesc] = createSignal<string>('')
  const [cover, setCover] = createSignal<string>('')
  const [viewed, setViewed] = createSignal(false)
  createEffect(
    on(
      [author, () => window],
      ([a, win]) => {
        if (a && win) {
          console.debug('[routes] author/[slug] author loaded fx')
          if (!a) return
          setTitle(() => `${t('Discours')}${a.name ? ` :: ${a.name}` : ''}`)
          setDesc(() => a.about || a.bio || '')
          setCover(() => (a.pic ? getFileUrl(a.pic || '', { width: 1200 }) : 'log.png'))

          // views google counter increment
          if (!viewed()) {
            window?.gtag?.('event', 'page_view', {
              page_title: author()?.name || '',
              page_location: window?.location.href || '',
              page_path: window?.location.pathname || ''
            })
            setViewed(true)
          }
        }
      },
      {}
    )
  )

  // author's shouts
  const authorShouts = createAsync(
    async () => (props.data.articles as Shout[]) || (await fetchAuthorShouts(props.params.slug, 0))
  )

  // author's comments
  const authorComments = createAsync(
    async () => (props.data.comments as Reaction[]) || (await fetchAuthorComments(props.params.slug, 0))
  )

  // Combine all loading states
  const isReady = createMemo(() => {
    return isSessionLoaded() && isClientMounted()
  })

  return (
    <Show when={isReady()} fallback={null}>
      <Show when={currentSlug()} keyed>
        {(_slug) => (
          <ErrorBoundary
            fallback={(_err) => {
              console.error('ErrorBoundary caught an error', _err)
              return <FourOuFourView />
            }}
          >
            <Suspense fallback={null}>
              <PageLayout
                title={title()}
                headerTitle={author()?.name || ''}
                slug={author()?.slug}
                desc={desc()}
                cover={cover()}
              >
                <ReactionsProvider>
                  <AuthorView
                    author={author() as Author}
                    authorSlug={props.params.slug}
                    shouts={authorShouts() || []}
                    comments={authorComments() || []}
                  />
                </ReactionsProvider>
              </PageLayout>
            </Suspense>
          </ErrorBoundary>
        )}
      </Show>
    </Show>
  )
}
