import { createResource } from 'solid-js'
import { defaultClient } from '~/graphql/client'
import getShoutQuery from '~/graphql/query/core/article-load'
import loadShoutsByQuery from '~/graphql/query/core/articles-load-by'
import loadShoutsSearchQuery from '~/graphql/query/core/articles-load-search'
import loadShoutsUnratedQuery from '~/graphql/query/core/articles-load-unrated'
import getAuthorQuery from '~/graphql/query/core/author-by'
import loadAuthorsAllQuery from '~/graphql/query/core/authors-all'
import loadAuthorsByQuery from '~/graphql/query/core/authors-load-by'
import loadReactionsByQuery from '~/graphql/query/core/reactions-load-by'
import getAuthorsByTopicQuery from '~/graphql/query/core/topic-authors'
import getFollowersByTopicQuery from '~/graphql/query/core/topic-followers'
import loadTopicsQuery from '~/graphql/query/core/topics-all'
import { QueryLoad_Shouts_ByArgs, Shout, Topic } from '~/graphql/schema/core.gen'
import {
  Author,
  QueryLoad_Authors_ByArgs,
  QueryLoad_Reactions_ByArgs,
  Reaction
} from '~/graphql/schema/core.gen'
import { QueryGet_ShoutArgs } from '~/graphql/schema/core.gen'
import { LoadShoutsOptions, QueryLoad_Shouts_SearchArgs } from '~/graphql/schema/core.gen'
import { QueryLoad_Shouts_UnratedArgs } from '~/graphql/schema/core.gen'
import { QueryGet_AuthorArgs } from '~/graphql/schema/core.gen'

// Topics API
/**
 * Прямой вызов для загрузки всех топиков
 * Используется с кешированием в IndexedDB (24 часа)
 * Подходит для SSR и одноразовых запросов
 * @example
 * ```ts
 * // В TopicsProvider:
 * const cached = await loadFromCache()
 * if (!cached || shouldUpdateTopics()) {
 *   const topicsLoader = loadTopics()
 *   const topics = await topicsLoader()
 *   await saveToCache(topics)
 *   updateLastUpdateTime()
 * }
 * ```
 */
export const loadTopics = () => {
  return async () => {
    const resp = await defaultClient.query(loadTopicsQuery, {}).toPromise()
    return resp?.data?.get_topics_all as Topic[]
  }
}

/**
 * Реактивный ресурс для загрузки топиков через контекст
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
export const useTopicsResource = () => {
  return createResource(loadTopics())
}

// Shouts API
/**
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
export const loadShouts = (args: QueryLoad_Shouts_ByArgs) => {
  return async () => {
    const resp = await defaultClient.query(loadShoutsByQuery, args).toPromise()
    return resp?.data?.load_shouts_by as Shout[]
  }
}

/**
 * Реактивный ресурс для загрузки шаутов
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
export const useShoutsResource = (args: QueryLoad_Shouts_ByArgs) => {
  return createResource(() => args, loadShouts(args))
}

// Authors API
/**
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
export const loadAuthors = (options: QueryLoad_Authors_ByArgs) => {
  return async () => {
    const resp = await defaultClient.query(loadAuthorsByQuery, options).toPromise()
    return resp?.data?.load_authors_by as Author[]
  }
}

/**
 * Реактивный ресурс для загрузки авторов с пагинацией
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
export const useAuthorsResource = (options: QueryLoad_Authors_ByArgs) => {
  return createResource(() => options, loadAuthors(options))
}

/**
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
 * Используется в AuthorsProvider для глобального состояния
 */
export const useAuthorsAllResource = () => {
  return createResource(loadAuthorsAll())
}

// Reactions API
/**
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
 * Особенности:
 * - Автоматическое обновление при изменении options
 * - Поддержка разных типов реакций (комментарии, оценки)
 * - Интеграция с ReactionsProvider
 */
export const useReactionsResource = (options: QueryLoad_Reactions_ByArgs) => {
  return createResource(() => options, loadReactions(options))
}

// Single Shout API
/**
 * Реактивный ресурс для загрузки одного шаута
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
  return createResource(
    () => options,
    (options: QueryGet_ShoutArgs) => {
      return async () => {
        const resp = await defaultClient.query(getShoutQuery, options).toPromise()
        return resp?.data?.get_shout as Shout
      }
    }
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
  return createResource(
    () => ({ text, options }),
    ({ text, options }) => {
      return async () => {
        const resp = await defaultClient
          .query(loadShoutsSearchQuery, { text, options } as QueryLoad_Shouts_SearchArgs)
          .toPromise()
        return resp?.data?.load_shouts_search as Shout[]
      }
    }
  )
}

// Unrated Shouts API
/**
 * Реактивный ресурс для загрузки неоцененных шаутов
 * Используется в FeedView для показа контента требующего модерации
 *
 * @example
 * ```tsx
 * // В FeedView с mode="unrated":
 * const [unrated] = useUnratedShouts({
 *   limit: FEED_PAGE_SIZE,
 *   offset: page() * FEED_PAGE_SIZE
 * })
 * ```
 */
export const useUnratedShouts = (options: LoadShoutsOptions) => {
  return createResource(
    () => options,
    (options: LoadShoutsOptions) => {
      return async () => {
        const resp = await defaultClient
          .query(loadShoutsUnratedQuery, { options } as QueryLoad_Shouts_UnratedArgs)
          .toPromise()
        return resp?.data?.load_shouts_unrated as Shout[]
      }
    }
  )
}

// Single Author API
/**
 * Реактивный ресурс для загрузки данных автора
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
  return createResource(
    () => options,
    (options: QueryGet_AuthorArgs) => {
      return async () => {
        const resp = await defaultClient.query(getAuthorQuery, options).toPromise()
        return resp?.data?.get_author as Author
      }
    }
  )
}

// @deprecated Legacy API
// будет удалено в следующих версиях

/**
 * @deprecated Используйте useShout вместо getShout
 * Пример миграции:
 * ```tsx
 * // Было в PageLayout.tsx:
 * const retryLoad = async () => {
 *   const res = await getShout({ slug: props.slug })()
 * }
 *
 * // Стало:
 * const [article] = useShout({ slug: props.slug })
 * <Show when={article()}>{(data) =>
 *   <Article article={data} />
 * }</Show>
 * ```
 */

/**
 * @deprecated Используйте useAuthor вместо getAuthor
 * Пример миграции:
 * ```tsx
 * // Было:
 * const authorLoader = getAuthor({ slug })
 * const author = await authorLoader()
 *
 * // Стало:
 * const [author] = useAuthor({ slug })
 * <Show when={author()}>{(data) =>
 *   <AuthorProfile author={data} />
 * }</Show>
 * ```
 */

/**
 * @deprecated Используйте useAuthorsResource с фильтрацией по топику
 */
export const getAuthorsByTopic = (slug: string) => {
  return async () => {
    const resp = await defaultClient.query(getAuthorsByTopicQuery, { slug }).toPromise()
    return resp?.data?.get_topic_authors as Author[]
  }
}

/**
 * @deprecated Используйте useAuthorsResource с фильтрацией по топику
 */
export const getFollowersByTopic = (slug: string) => {
  return async () => {
    const resp = await defaultClient.query(getFollowersByTopicQuery, { slug }).toPromise()
    return resp?.data?.get_topic_followers as Author[]
  }
}

/**
 * @deprecated Используйте useShoutsSearch вместо loadShoutsSearch
 * Пример миграции:
 * ```tsx
 * // Было:
 * const searchLoader = loadShoutsSearch(query, { limit: 10 })
 * const results = await searchLoader()
 *
 * // Стало:
 * const [results] = useShoutsSearch(query(), { limit: 10 })
 * <For each={results()}>{shout =>
 *   <SearchResultItem shout={shout} />
 * }</For>
 * ```
 */

/**
 * @deprecated Используйте useUnratedShouts вместо loadUnratedShouts
 */
export const loadUnratedShouts = (options: LoadShoutsOptions) => {
  return async () => {
    const resp = await defaultClient
      .query(loadShoutsUnratedQuery, { options } as QueryLoad_Shouts_UnratedArgs)
      .toPromise()
    return resp?.data?.load_shouts_unrated as Shout[]
  }
}

/**
 * @deprecated Используйте useShout вместо getShout
 * Пример миграции:
 * ```tsx
 * // Было в PageLayout.tsx:
 * const retryLoad = async () => {
 *   const res = await getShout({ slug: props.slug })()
 * }
 *
 * // Стало:
 * const [article] = useShout({ slug: props.slug })
 * <Show when={article()}>{(data) =>
 *   <Article article={data} />
 * }</Show>
 * ```
 */
export const getShout = (options: QueryGet_ShoutArgs) => {
  return async () => {
    const resp = await defaultClient.query(getShoutQuery, options).toPromise()
    return resp?.data?.get_shout as Shout
  }
}

/**
 * @deprecated Используйте useShoutsSearch вместо loadShoutsSearch
 * Пример миграции:
 * ```tsx
 * // Было в SearchView:
 * const searchLoader = loadShoutsSearch(query, { limit: 10 })
 * const results = await searchLoader()
 *
 * // Стало:
 * const [results] = useShoutsSearch(query(), { limit: 10 })
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
 * @deprecated Используйте useAuthor вместо getAuthor
 * Пример миграции:
 * ```tsx
 * // Было в AuthorView:
 * const authorLoader = getAuthor({ slug })
 * const author = await authorLoader()
 *
 * // Стало:
 * const [author] = useAuthor({ slug })
 * <Show when={author()}>{(data) =>
 *   <AuthorProfile author={data} />
 * }</Show>
 * ```
 */
export const getAuthor = (options: QueryGet_AuthorArgs) => {
  return async () => {
    const resp = await defaultClient.query(getAuthorQuery, options).toPromise()
    return resp?.data?.get_author as Author
  }
}
