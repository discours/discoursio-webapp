import { createResource } from 'solid-js'
import { defaultClient } from '~/graphql/client'
import { createLoader, createQueryResource } from '~/graphql/client'
import getShoutQuery from '~/graphql/query/core/article-load'
import loadShoutsByQuery from '~/graphql/query/core/articles-load-by'
import loadShoutsSearchQuery from '~/graphql/query/core/articles-load-search'
import loadShoutsUnratedQuery from '~/graphql/query/core/articles-load-unrated'
import getAuthorQuery from '~/graphql/query/core/author-by'
import loadAuthorsAllQuery from '~/graphql/query/core/authors-all'
import loadAuthorsByQuery from '~/graphql/query/core/authors-load-by'
import loadCommentsBranchQuery from '~/graphql/query/core/comments-load-branch'
import loadReactionsByQuery from '~/graphql/query/core/reactions-load-by'
import getAuthorsByTopicQuery from '~/graphql/query/core/topic-authors'
import getFollowersByTopicQuery from '~/graphql/query/core/topic-followers'
import loadTopicsQuery from '~/graphql/query/core/topics-all'
import loadTopicsByCommunityQuery from '~/graphql/query/core/topics-by-community'
import {
  QueryLoad_Comments_BranchArgs,
  QueryLoad_Shouts_ByArgs,
  Shout,
  Topic
} from '~/graphql/schema/core.gen'
import {
  Author,
  QueryLoad_Authors_ByArgs,
  QueryLoad_Reactions_ByArgs,
  Reaction
} from '~/graphql/schema/core.gen'
import { QueryGet_ShoutArgs } from '~/graphql/schema/core.gen'
import { LoadShoutsOptions, QueryLoad_Shouts_SearchArgs } from '~/graphql/schema/core.gen'
import { QueryLoad_Shouts_UnratedArgs } from '~/graphql/schema/core.gen'
import {
  QueryGet_AuthorArgs,
  QueryGet_TopicArgs,
  QueryGet_Topics_By_CommunityArgs
} from '~/graphql/schema/core.gen'

// Topics API
/**
 * Прямой метод без кеширования
 * Прямой вызов для загрузки всех топиков
 * Используется с кешированием в IndexedDB (24 часа)
 * Подходит для SSR и одноразовых запросов
 */
export const loadTopics = () => {
  return async () => {
    const resp = await defaultClient.query(loadTopicsQuery, {} as QueryGet_TopicArgs).toPromise()
    return resp?.data?.get_topics_all as Topic[]
  }
}

export const loadTopicsByCommunity = (options: QueryGet_Topics_By_CommunityArgs) => {
  return async () => {
    const resp = await defaultClient.query(loadTopicsByCommunityQuery, options).toPromise()
    return resp?.data?.get_topics_by_community as Topic[]
  }
}

/**
 * Реактивный ресурс для загрузки топиков через контекст
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Включает:
 * - Кеширование в IndexedDB на 24 часа
 * - Автоматическую сортировку по популярности
 * - Обновление только при истечении кеша
 * - Мемоизацию для предотвращения лишних рендеров
 *
 * @example
 * ```tsx
 * // В компоненте:
 * const { sortedTopics } = useTopics() // Используем контекст вместо ресурса напрямую
 *
 * return (
 *   <For each={sortedTopics()}>{topic =>
 *     <TopicBadge topic={topic} />
 *   }</For>
 * )
 *
 * // Для случайного топика:
 * const { randomTopic } = useTopics()
 * <Show when={randomTopic()}>
 *   <TopicBadge topic={randomTopic()} />
 * </Show>
 * ```
 *
 * @see TopicsProvider для деталей реализации кеширования и мемоизации
 * @see docs/caching-v2.md для общей стратегии кеширования
 */
export const useTopicsResource = createQueryResource<Topic[], void>(loadTopicsQuery, () => ({}))

// Shouts API
/**
 * Прямой метод без кеширования
 * Прямой вызов для загрузки шаутов
 * Подходит для SSR и одноразовых запросов без реактивности
 * @example
 * ```ts
 * const shoutsLoader = loadShouts({
 *   options: {
 *     limit: 10,
 *     filters: { featured: true }
 *   }
 * })
 * const shouts = await shoutsLoader()
 * ```
 */
export const loadShouts = createLoader<Shout[], QueryLoad_Shouts_ByArgs>(
  loadShoutsByQuery,
  (args: QueryLoad_Shouts_ByArgs) => args
)

/**
 * Реактивный ресурс для загрузки шаутов
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Особенности:
 * - Автоматическое отслеживание изменений args
 * - Встроенные состояния loading/error
 * - Отмена устаревших запросов
 * - Автоматическая перезагрузка при изменении параметров
 *
 * @example
 * ```tsx
 * const [shouts, { refetch }] = useShoutsResource({
 *   options: {
 *     limit: 10,
 *     filters: { featured: true }
 *   }
 * })
 *
 * // Правильная обработка всех состояний
 * return (
 *   <Show when={!shouts.loading} fallback={<Loading />}>
 *     <Show when={!shouts.error} fallback={<Error error={shouts.error} />}>
 *       <For each={shouts()}>{shout =>
 *         <ArticleCard shout={shout} />
 *       }</For>
 *     </Show>
 *   </Show>
 * )
 * ```
 *
 * @see docs/solid-async.md для деталей работы с асинхронными ресурсами
 */
export const useShoutsResource = (initialArgs: QueryLoad_Shouts_ByArgs) => {
  return createQueryResource<Shout[], QueryLoad_Shouts_ByArgs>(
    loadShoutsByQuery,
    () => initialArgs,
    defaultClient,
    true // withAbort
  )
}

// Authors API
/**
 * Прямой метод без кеширования
 * Прямой вызов для загрузки авторов с фильтрацией
 * Подходит для SSR и одноразовых запросов
 * @example
 * ```ts
 * // В AuthorsProvider:
 * const authorsLoader = loadAuthors({
 *   by: { order: 'followers' },
 *   limit: 20,
 *   offset: 0
 * })
 * const authors = await authorsLoader()
 * ```
 */
export const loadAuthors = createLoader<Author[], QueryLoad_Authors_ByArgs>(
  loadAuthorsByQuery,
  (options: QueryLoad_Authors_ByArgs) => options
)

/**
 * Реактивный ресурс для загрузки авторов с пагинацией
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Особенности:
 * - Автоматическое отслеживание изменений options
 * - Встроенные состояния loading/error
 * - Поддержка сортировки и фильтрации
 *
 * @example
 * ```tsx
 * // В AllAuthorsView:
 * const [authors, { refetch }] = useAuthorsResource({
 *   by: { order: 'followers' },
 *   limit: 20,
 *   offset: page() * 20
 * })
 *
 * return (
 *   <Show when={!authors.loading} fallback={<Loading />}>
 *     <For each={authors()}>{author =>
 *       <AuthorCard author={author} />
 *     }</For>
 *   </Show>
 * )
 * ```
 */
export const useAuthorsResource = createQueryResource<Author[], QueryLoad_Authors_ByArgs>(
  loadAuthorsByQuery,
  (options: QueryLoad_Authors_ByArgs) => options
)

/**
 * Прямой метод без кеширования
 * Прямой вызов для загрузки всех авторов
 * Используется для начальной загрузки и кеширования
 */
export const loadAuthorsAll = () => {
  return async () => {
    const resp = await defaultClient.query(loadAuthorsAllQuery, {}).toPromise()
    return resp?.data?.get_authors_all as Author[]
  }
}

/**
 * Реактивный ресурс для загрузки всех авторов
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Используется в AuthorsProvider для глобального состояния
 */
export const useAuthorsAllResource = () => {
  return createResource(loadAuthorsAll())
}

// Reactions API
/**
 * Прямой метод без кеширования
 * Прямой вызов для загрузки реакций (комментариев)
 * Подходит для SSR и одноразовых запросов
 * @example
 * ```ts
 * const reactionsLoader = loadReactions({
 *   by: {
 *     kinds: [ReactionKind.Comment],
 *     sort: ReactionSort.Newest
 *   },
 *   limit: 10
 * })
 * const comments = await reactionsLoader()
 * ```
 */
export const loadReactions = (options: QueryLoad_Reactions_ByArgs) => {
  return async () => {
    const resp = await defaultClient.query(loadReactionsByQuery, options).toPromise()
    return resp?.data?.load_reactions_by as Reaction[]
  }
}

/**
 * Реактивный ресурс для загрузки реакций
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Особенности:
 * - Автоматическое обновление при изменении options
 * - Поддержка разных типов реакций (комментарии, оценки)
 * - Интеграция с ReactionsProvider
 */
export const useReactionsResource = (options: QueryLoad_Reactions_ByArgs) => {
  return createQueryResource<Reaction[], QueryLoad_Reactions_ByArgs>(
    loadReactionsByQuery,
    () => options,
    defaultClient,
    true // withAbort
  )
}

// Single Shout API
/**
 * Реактивный ресурс дл загрузки одного шаута
 * Особенности:
 * - Автоматическое обновление при изменении slug
 * - Встроенные состояния loading/error
 * - Интеграция с SSR через route.load
 *
 * @example
 * ```tsx
 * // В ArticleView:
 * const [shout] = useShout({ slug: props.params.slug })
 *
 * return (
 *   <Show when={!shout.loading} fallback={<Loading />}>
 *     <Show when={!shout.error} fallback={<Error error={shout.error} />}>
 *       <Article shout={shout()} />
 *     </Show>
 *   </Show>
 * )
 * ```
 *
 * @see docs/solid-async.md для деталей работы с SSR
 */
export const useShout = (options: QueryGet_ShoutArgs) => {
  return createQueryResource<Shout, QueryGet_ShoutArgs>(
    getShoutQuery,
    () => options,
    defaultClient,
    true // withAbort
  )
}

// Search API
/**
 * Реактивный ресурс для поиска шаутов
 * Особенности:
 * - Автоматическое обновление при изменении запроса
 * - Дебаунсинг запросов
 * - Отмена устаревших запросов
 *
 * @example
 * ```tsx
 * // В SearchView:
 * const [query, setQuery] = createSignal('')
 * const [results] = useShoutsSearch(query(), {
 *   limit: 10,
 *   offset: page() * 10
 * })
 *
 * return (
 *   <Show when={!results.loading} fallback={<SearchSkeleton />}>
 *     <For each={results()}>{shout =>
 *       <SearchResultItem shout={shout} />
 *     }</For>
 *   </Show>
 * )
 * ```
 */
export const useShoutsSearch = (text: string, options: LoadShoutsOptions) => {
  return createQueryResource<Shout[], QueryLoad_Shouts_SearchArgs>(
    loadShoutsSearchQuery,
    () => ({ text, options }),
    defaultClient,
    true // withAbort
  )
}

// Unrated Shouts API
/**
 * Реактивный ресурс для загрузки неоцененных шаутов
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Используется в FeedView для показа контента требующего модерации
 */
export const useUnratedShouts = (options: LoadShoutsOptions) => {
  return createQueryResource<Shout[], QueryLoad_Shouts_UnratedArgs>(
    loadShoutsUnratedQuery,
    () => ({ options }),
    defaultClient,
    true // withAbort
  )
}

/**
 * Прямой метод без кеширования
 * Загрузка неоцененных статей
 * Используется для SSR и начальной загрузки данных
 */
export const loadUnratedShouts = createLoader<Shout[], LoadShoutsOptions>(
  loadShoutsUnratedQuery,
  (options: LoadShoutsOptions) => ({ options }) as QueryLoad_Shouts_UnratedArgs
)

// Single Author API
/**
 * Реактивный ресрс для загрузки данных автора
 * Особенности:
 * - Автоматическое обновление при изменении slug
 * - Интеграция с AuthorsProvider
 * - Поддержка SSR через route.load
 *
 * @example
 * ```tsx
 * // В AuthorView:
 * const [author] = useAuthor({ slug: props.params.slug })
 *
 * return (
 *   <Show when={author()} fallback={<Loading />}>
 *     <AuthorProfile author={author()} />
 *     <AuthorFeed authorSlug={props.params.slug} />
 *   </Show>
 * )
 * ```
 */
export const useAuthor = (options: QueryGet_AuthorArgs) => {
  return createQueryResource<Author, QueryGet_AuthorArgs>(
    getAuthorQuery,
    () => options,
    defaultClient,
    true // withAbort
  )
}

// @deprecated Legacy API
// будет удалено в следующих версиях

/**
 * Прямой метод без кеширования
 * Загрука статьи по slug
 * Используется для SSR и начальной загрузки данных
 *
 * @example
 * ```tsx
 * // В route.load:
 * const article = await getShout({ slug })()
 * ```
 */
export const getShout = (options: QueryGet_ShoutArgs) => {
  return async () => {
    const resp = await defaultClient.query(getShoutQuery, options).toPromise()
    return resp?.data?.get_shout as Shout
  }
}

/**
 * Прямой метод без кеширования
 * Загрузка автора по slug
 * Используется для SSR и начальной загрузки данных
 *
 * @example
 * ```tsx
 * // В route.load:
 * const author = await getAuthor({ slug })()
 * ```
 */
export const getAuthor = (options: QueryGet_AuthorArgs) => {
  return async () => {
    const resp = await defaultClient.query(getAuthorQuery, options).toPromise()
    return resp?.data?.get_author as Author
  }
}

/**
 * Прямой метод без кеширования
 * Загрузка авторов по топику
 * Используется для SSR и начальной загрузки данных
 *
 * @example
 * ```tsx
 * // В TopicView для SSR:
 * const authors = await getAuthorsByTopic(slug)()
 * ```
 */
export const getAuthorsByTopic = (slug: string) => {
  return async () => {
    const resp = await defaultClient.query(getAuthorsByTopicQuery, { slug }).toPromise()
    return resp?.data?.get_topic_authors as Author[]
  }
}

/**
 * Прямой метод без кеширования
 * Загрузка подписчиков топика
 * Используется для SSR и начальной загрузки данных
 */
export const getFollowersByTopic = (slug: string) => {
  return async () => {
    const resp = await defaultClient.query(getFollowersByTopicQuery, { slug }).toPromise()
    return resp?.data?.get_topic_followers as Author[]
  }
}

/**
 * Прямой метод без кеширования
 * @deprecated Используйте useShoutsSearch вместо loadShoutsSearch
 * Активно используется в SearchModal для реактивного поиска
 *
 * @example
 * ```tsx
 * // Было в SearchModal:
 * const results = await loadShoutsSearch(query, options)()
 *
 * // Стало:
 * const [results] = useShoutsSearch(query(), options)
 * <For each={results()}>{result =>
 *   <SearchResultItem result={result} />
 * }</For>
 * ```
 */
export const loadShoutsSearch = (text: string, options: LoadShoutsOptions) => {
  return async () => {
    const resp = await defaultClient
      .query(loadShoutsSearchQuery, { text, options } as QueryLoad_Shouts_SearchArgs)
      .toPromise()
    return resp?.data?.load_shouts_search as Shout[]
  }
}

/**
 * Загружает комментарии с учетом их иерархической структуры
 */
export const loadCommentsBranch = (opts: QueryLoad_Comments_BranchArgs) => {
  return async () => {
    try {
      const result = await defaultClient.query(loadCommentsBranchQuery, opts).toPromise()

      if (result.error) {
        console.error('[API] loadCommentsBranch error:', result.error)
        return []
      }

      // Просто возвращаем данные с проверкой на null
      return result.data?.load_comments_branch || []
    } catch (error) {
      console.error('[API] loadCommentsBranch error:', error)
      return []
    }
  }
}
