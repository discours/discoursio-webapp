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
 * import AuthorPage from '~/routes/author/[slug]/[...mode]'
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

import { RouteSectionProps, useParams, useSearchParams } from '@solidjs/router'
import { createEffect, createMemo, createResource, createSignal, ErrorBoundary, on, onMount, Show } from 'solid-js'
import { PageLayout } from '~/components/_shared/PageLayout'
import { AuthorView } from '~/components/Views/AuthorView'
import { FourOuFourView } from '~/components/Views/FourOuFour'
import { COMMENTS_PER_PAGE } from '~/constants/pagination'
import { useAuthors } from '~/context/authors'
import { FEED_PAGE_SIZE, orderByMode, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { ReactionsProvider } from '~/context/reactions'
import { useSession } from '~/context/session'
import { getAuthor, loadReactions, loadShouts, loadTopics } from '~/graphql/api/public'
import {
  Author,
  LoadShoutsOptions,
  QueryLoad_Reactions_ByArgs,
  Reaction,
  ReactionKind,
  Shout,
  Topic
} from '~/graphql/generated/graphql'
import { getTimestampFromPeriod, PeriodType } from '~/lib/fromPeriod'
import { getFileUrl } from '~/lib/imageCache'
import { FeedMode } from '~/types/nav'

const fetchAuthorShouts = async (slug: string, offset?: number) => {
  const options: LoadShoutsOptions = { filters: { author: slug }, limit: FEED_PAGE_SIZE, offset }
  const shoutsLoader = loadShouts({ options })
  return await shoutsLoader()
}

const fetchAuthorComments = async (author: Author, offset?: number) => {
  const opts: QueryLoad_Reactions_ByArgs = {
    by: { kinds: [ReactionKind.Comment], created_by: author.id },
    limit: COMMENTS_PER_PAGE,
    offset
  }
  console.log('[fetchAuthorComments] Loading comments for author:', author.slug, 'with opts:', opts)
  const shoutsLoader = loadReactions(opts)
  const result = await shoutsLoader()

  console.log('[fetchAuthorComments] Loaded reactions:', result?.length || 0)
  if (result?.length) {
    // Диагностика: проверяем типы загруженных реакций
    const reactionTypes = result.map((r) => ({ id: r.id, kind: r.kind, body: r.body?.slice(0, 50) }))
    console.log('[fetchAuthorComments] Reaction types loaded:', reactionTypes)

    // Проверяем, есть ли реакции не типа Comment
    const nonComments = result.filter((r) => r.kind !== ReactionKind.Comment)
    if (nonComments.length > 0) {
      console.warn(
        '[fetchAuthorComments] Found non-comment reactions:',
        nonComments.map((r) => ({ id: r.id, kind: r.kind }))
      )
    }
  }

  return result
}

const fetchAllTopics = async () => {
  const topicsFetcher = loadTopics()
  return await topicsFetcher()
}

const fetchAuthor = async (slug: string) => {
  // 🔧 ИСПРАВЛЕНИЕ: Используем getAuthor для загрузки полной статистики с комментариями
  const authorFetcher = getAuthor({ slug })
  const author = await authorFetcher()
  return author
}

export const route = {
  load: async ({ params, location: { query } }: RouteSectionProps<{ articles: Shout[] }>) => {
    const offset: number = Number.parseInt(query.offset as string, 10)
    console.debug('route loading with offset', offset)

    // Сначала загружаем автора
    const author = await fetchAuthor(params.slug)

    // Если автор загружен, можем загрузить его комментарии
    let comments: Reaction[] = []
    if (author) {
      comments = await fetchAuthorComments(author, 0)
    }

    return {
      author,
      articles: await fetchAuthorShouts(params.slug, offset),
      topics: await fetchAllTopics(),
      comments
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
    on([() => params.slug, () => params.mode, () => searchParams.period], ([newSlug, newMode, newPeriod]) => {
      setCurrentSlug(newSlug)
      const opts: LoadShoutsOptions = { ...options() }

      if (typeof newMode === 'string' && newMode !== 'comments' && newMode !== 'about') {
        opts.order_by = orderByMode(newMode as FeedMode)
      }

      if (newPeriod) {
        opts.filters = {
          ...(opts.filters || {}),
          after: getTimestampFromPeriod(newPeriod as PeriodType)
        }
      }
      updateOptions(opts)
    })
  )

  // load author's profile
  const { addAuthor, authorsEntities } = useAuthors()
  const [author, setAuthor] = createSignal<Author | undefined>(props.data.author)
  createEffect(
    on(
      author,
      async (profile) => {
        // update only if no profile loaded
        if (!profile) {
          const loadedAuthor = authorsEntities()[props.params.slug] || (await fetchAuthor(props.params.slug))
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
  const [authorShouts] = createResource(
    () => props.params.slug,
    async (slug) => {
      try {
        return props.data.articles || (await fetchAuthorShouts(slug, 0))
      } catch (error) {
        console.error('Error loading author shouts:', error)
        return []
      }
    },
    {
      initialValue: props.data.articles
    }
  )

  // author's comments - используем прямой доступ к props.data для SSR стабильности
  const [authorComments] = createResource(
    () => props.params.slug, // Зависимость от slug, а не от author для стабильности
    async (slug) => {
      try {
        // Сначала возвращаем данные из route.load
        if (props.data.comments) {
          console.log('[AuthorRoute] Using comments from route.load:', props.data.comments.length)
          return props.data.comments
        }

        // Fallback: загружаем автора и его комментарии
        const authorData = author()
        if (!authorData) {
          console.log('[AuthorRoute] No author data, loading author first')
          const loadedAuthor = await fetchAuthor(slug)
          if (loadedAuthor) {
            return await fetchAuthorComments(loadedAuthor, 0)
          }
          return []
        }

        console.log('[AuthorRoute] Loading comments for author:', authorData.slug)
        return await fetchAuthorComments(authorData, 0)
      } catch (error) {
        console.error('Error loading author comments:', error)
        return []
      }
    },
    {
      initialValue: props.data.comments || []
    }
  )

  // Combine all loading states
  const isReady = createMemo(() => {
    return isSessionLoaded() && isClientMounted() && !authorShouts.loading && !authorComments.loading
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
            <Show when={!(authorShouts.error || authorComments.error)}>
              <PageLayout
                title={title()}
                headerTitle={author()?.name || ''}
                slug={author()?.slug}
                desc={desc()}
                cover={cover()}
                author={author() as Author}
              >
                <ReactionsProvider>
                  <AuthorView
                    author={author() as Author}
                    authorSlug={decodeURIComponent(props.params.slug)}
                    shouts={authorShouts() || []}
                    comments={authorComments() || []}
                  />
                </ReactionsProvider>
              </PageLayout>
            </Show>
          </ErrorBoundary>
        )}
      </Show>
    </Show>
  )
}
