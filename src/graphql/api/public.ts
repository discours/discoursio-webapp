import { defaultClient } from '~/graphql/client'
import {
  createCacheableLoader,
  createCacheableQueryResource,
  createLoader,
  createQueryResource
} from '~/graphql/client'
import getShoutQuery from '~/graphql/query/core/article-load'
import loadShoutsByQuery from '~/graphql/query/core/articles-load-by'
import loadShoutsSearchQuery from '~/graphql/query/core/articles-load-search'
import loadShoutsUnratedQuery from '~/graphql/query/core/articles-load-unrated'
import getAuthorQuery from '~/graphql/query/core/author-by'
import loadAuthorsAllQuery from '~/graphql/query/core/authors-all'
import loadAuthorsByQuery from '~/graphql/query/core/authors-load-by'
import loadAuthorsSearchQuery from '~/graphql/query/core/authors-load-search'
import loadCommentsBranchQuery from '~/graphql/query/core/comments-load-branch'
import loadReactionsByQuery from '~/graphql/query/core/reactions-load-by'
import getAuthorsByTopicQuery from '~/graphql/query/core/topic-authors'
import getFollowersByTopicQuery from '~/graphql/query/core/topic-followers'
import loadTopicsQuery from '~/graphql/query/core/topics-all'
import loadTopicsByCommunityQuery from '~/graphql/query/core/topics-by-community'
import topicBySlugQuery from '~/graphql/query/core/topic-by-slug'
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
import { QueryLoad_Authors_SearchArgs } from '~/graphql/schema/core.gen'

// Topics API
/**
 * Кешируемый метод для загрузки всех топиков
 * Использует браузерное кеширование для оптимизации повторных запросов
 * Подходит для SSR и клиентских запросов
 *
 * @example
 * ```ts
 * // В route.load (SSR):
 * const topicsLoader = loadTopics()
 * const topics = await topicsLoader()
 *
 * // В компоненте (клиент):
 * const topics = await loadTopics()()
 * ```
 */
export const loadTopics = () => {
  return createCacheableLoader<Topic[], void>(
    loadTopicsQuery,
    () => ({}) as QueryGet_TopicArgs,
    true // Включаем браузерное кеширование для топиков
  )(undefined)
}

/**
 * Реактивный ресурс для загрузки всех топиков с кешированием
 * Оптимизирован для статичных данных с долгим временем жизни
 */
export const useTopicsResource = () => {
  return createCacheableQueryResource<Topic[], void>(
    loadTopicsQuery,
    () => ({}),
    true, // Включаем браузерное кеширование
    defaultClient,
    true // withAbort
  )(undefined)
}

/**
 * Загрузка топиков по сообществу с кешированием
 */
export const loadTopicsByCommunity = createCacheableLoader<Topic[], QueryGet_Topics_By_CommunityArgs>(
  loadTopicsByCommunityQuery,
  (args: QueryGet_Topics_By_CommunityArgs) => args,
  true // Кешируем топики по сообществу
)

// Shouts API
/**
 * Кешируемый метод для загрузки шаутов
 * Использует браузерное кеширование для публичных статей
 * Подходит для SSR и одноразовых запросов без реактивности
 *
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
export const loadShouts = createCacheableLoader<Shout[], QueryLoad_Shouts_ByArgs>(
  loadShoutsByQuery,
  (args: QueryLoad_Shouts_ByArgs) => args,
  true // Включаем кеширование для публичных статей
)

/**
 * Реактивный ресурс для загрузки шаутов с кешированием
 * Оптимизирован для публичного контента
 */
export const useShoutsResource = createCacheableQueryResource<Shout[], QueryLoad_Shouts_ByArgs>(
  loadShoutsByQuery,
  (args: QueryLoad_Shouts_ByArgs) => args,
  true, // Включаем кеширование
  defaultClient,
  true // withAbort
)

/**
 * Поиск статей с кешированием результатов
 */
export const loadShoutsSearch = createCacheableLoader<Shout[], QueryLoad_Shouts_SearchArgs>(
  loadShoutsSearchQuery,
  (args: QueryLoad_Shouts_SearchArgs) => args,
  true // Кешируем результаты поиска
)

// Authors API
/**
 * Кешируемый метод для загрузки авторов с фильтрацией
 * Использует браузерное кеширование для публичных профилей
 * Подходит для SSR и одноразовых запросов
 *
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
export const loadAuthors = createCacheableLoader<Author[], QueryLoad_Authors_ByArgs>(
  loadAuthorsByQuery,
  (options: QueryLoad_Authors_ByArgs) => options,
  true // Включаем кеширование для авторов
)

/**
 * Реактивный ресурс для загрузки авторов с кешированием
 */
export const useAuthorsResource = createCacheableQueryResource<Author[], QueryLoad_Authors_ByArgs>(
  loadAuthorsByQuery,
  (options: QueryLoad_Authors_ByArgs) => options,
  true, // Включаем кеширование
  defaultClient,
  true // withAbort
)

/**
 * Поиск авторов с кешированием
 */
export const loadAuthorsSearch = createCacheableLoader<Author[], QueryLoad_Authors_SearchArgs>(
  loadAuthorsSearchQuery,
  (options: QueryLoad_Authors_SearchArgs) => options,
  true // Кешируем результаты поиска авторов
)

/**
 * Кешируемый метод для загрузки всех авторов
 * Используется для начальной загрузки и кеширования
 */
export const loadAuthorsAll = () => {
  return createCacheableLoader<Author[], void>(
    loadAuthorsAllQuery,
    () => ({}),
    true // Включаем кеширование для списка всех авторов
  )(undefined)
}

// Reactions API
/**
 * НЕ кешируемый метод для загрузки реакций (комментариев)
 * Реакции часто обновляются и могут содержать персональные данные
 * Подходит для SSR и одноразовых запросов
 *
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
 * Реактивный ресурс для загрузки реакций БЕЗ кеширования
 * Реакции требуют актуальных данных
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
 * Кешируемый реактивный ресурс для загрузки одного шаута
 * Использует браузерное кеширование для опубликованных статей
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
 */
export const useShout = (options: QueryGet_ShoutArgs) => {
  return createCacheableQueryResource<Shout, QueryGet_ShoutArgs>(
    getShoutQuery,
    () => options,
    true, // Включаем кеширование для статей
    defaultClient,
    true // withAbort
  )
}

/**
 * Кешируемый реактивный ресурс для загрузки данных автора
 * Использует браузерное кеширование для публичных профилей
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
  return createCacheableQueryResource<Author, QueryGet_AuthorArgs>(
    getAuthorQuery,
    () => options,
    true, // Включаем кеширование для авторов
    defaultClient,
    true // withAbort
  )
}

// Unrated Shouts API (НЕ кешируются - требуют актуальных данных для модерации)
/**
 * Реактивный ресурс для загрузки неоцененных шаутов БЕЗ кеширования
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
 * Прямой метод без кеширования для загрузки неоцененных статей
 * Используется для SSR и начальной загрузки данных
 */
export const loadUnratedShouts = createLoader<Shout[], LoadShoutsOptions>(
  loadShoutsUnratedQuery,
  (options: LoadShoutsOptions) => ({ options }) as QueryLoad_Shouts_UnratedArgs
)

// Topic Authors API (кешируется)
/**
 * Кешируемая загрузка авторов по топику
 */
export const loadTopicAuthors = (args: QueryGet_AuthorArgs) => {
  return createCacheableLoader<Author[], QueryGet_AuthorArgs>(
    getAuthorsByTopicQuery,
    () => args,
    true // Кешируем авторов по топику
  )(args)
}

/**
 * Кешируемая загрузка подписчиков топика
 */
export const loadTopicFollowers = (args: QueryGet_AuthorArgs) => {
  return createCacheableLoader<Author[], QueryGet_AuthorArgs>(
    getFollowersByTopicQuery,
    () => args,
    true // Кешируем подписчиков топика
  )(args)
}

// Comments Branch API (НЕ кешируется - часто обновляется)
/**
 * Загружает комментарии с учетом их иерархической структуры БЕЗ кеширования
 * Комментарии требуют актуальных данных
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

// @deprecated Legacy API - будет удалено в следующих версиях
// Оставляем для обратной совместимости, но используем кеширование где возможно

/**
 * @deprecated Используйте useShout вместо getShout
 * Кешируемый метод для загрузки статьи по slug
 */
export const getShout = (options: QueryGet_ShoutArgs) => {
  return createCacheableLoader<Shout, QueryGet_ShoutArgs>(
    getShoutQuery,
    () => options,
    true // Включаем кеширование
  )(options)
}

/**
 * @deprecated Используйте useAuthor вместо getAuthor
 * Кешируемый метод для загрузки автора по slug
 */
export const getAuthor = (options: QueryGet_AuthorArgs) => {
  return createCacheableLoader<Author, QueryGet_AuthorArgs>(
    getAuthorQuery,
    () => options,
    true // Включаем кеширование
  )(options)
}

/**
 * Кешируемый метод для загрузки топика по slug
 * Использует браузерное кеширование для публичных топиков
 * Подходит для SSR и клиентских запросов
 *
 * @example
 * ```ts
 * // В route.load (SSR):
 * const topicLoader = loadTopicBySlug('javascript')
 * const topic = await topicLoader()
 *
 * // В компоненте (клиент):
 * const topic = await loadTopicBySlug('javascript')()
 * ```
 */
export const loadTopicBySlug = (slug: string) => {
  return createCacheableLoader<Topic, QueryGet_TopicArgs>(
    topicBySlugQuery,
    (args: QueryGet_TopicArgs) => args,
    true // Включаем кеширование для топиков
  )({ slug })
}

/**
 * Реактивный ресурс для загрузки топика по slug с кешированием
 * Оптимизирован для публичных топиков
 */
export const useTopicBySlug = (slug: string) => {
  return createCacheableQueryResource<Topic, QueryGet_TopicArgs>(
    topicBySlugQuery,
    () => ({ slug }),
    true, // Включаем кеширование
    defaultClient,
    true // withAbort
  )({ slug })
}
