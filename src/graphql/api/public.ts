import { createCacheableLoader, createCacheableQueryResource, createLoader, defaultClient } from '~/graphql/client'
import {
  Author,
  LoadShoutsOptions,
  QueryGet_AuthorArgs,
  QueryGet_ShoutArgs,
  QueryGet_TopicArgs,
  QueryGet_Topics_By_CommunityArgs,
  QueryLoad_Authors_ByArgs,
  QueryLoad_Authors_SearchArgs,
  QueryLoad_Comments_BranchArgs,
  QueryLoad_Reactions_ByArgs,
  QueryLoad_Shouts_ByArgs,
  QueryLoad_Shouts_SearchArgs,
  QueryLoad_Shouts_UnratedArgs,
  Reaction,
  Shout,
  Topic
} from '~/graphql/generated/graphql'
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
import topicBySlugQuery from '~/graphql/query/core/topic-by-slug'
import getFollowersByTopicQuery from '~/graphql/query/core/topic-followers'
import loadTopicsQuery from '~/graphql/query/core/topics-all'
import loadTopicsByCommunityQuery from '~/graphql/query/core/topics-by-community'

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
  const loader = createCacheableLoader<{ get_topics_all: Topic[] }, void>(
    loadTopicsQuery,
    () => ({}) as QueryGet_TopicArgs,
    true // Включаем браузерное кеширование для топиков
  )(undefined)

  return async () => {
    try {
      console.log('[loadTopics] Starting API call...')
      const response = await loader()
      // console.log('[loadTopics] API response:', response)
      const topics = response?.get_topics_all || []
      console.log('[loadTopics] Extracted topics:', topics.length, 'topics')
      return topics
    } catch (error) {
      console.error('[loadTopics] API error:', error)
      return []
    }
  }
}

/**
 * Реактивный ресурс для загрузки всех топиков с кешированием
 * Оптимизирован для статичных данных с долгим временем жизни
 */
export const useTopicsResource = () => {
  return createCacheableQueryResource<{ get_topics_all: Topic[] }, void>(
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
export const loadTopicsByCommunity = (args: QueryGet_Topics_By_CommunityArgs) => {
  const loader = createCacheableLoader<{ get_topics_by_community: Topic[] }, QueryGet_Topics_By_CommunityArgs>(
    loadTopicsByCommunityQuery,
    (args: QueryGet_Topics_By_CommunityArgs) => args,
    true // Кешируем топики по сообществу
  )(args)

  return async () => {
    try {
      console.log('[loadTopicsByCommunity] Starting API call with args:', args)
      const response = await loader()
      const topics = response?.get_topics_by_community || []
      console.log('[loadTopicsByCommunity] Extracted topics:', topics.length, 'topics')
      return topics
    } catch (error) {
      console.error('[loadTopicsByCommunity] API error:', error)
      return []
    }
  }
}

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
export const loadShouts = (args: QueryLoad_Shouts_ByArgs) => {
  const loader = createCacheableLoader<{ load_shouts_by: Shout[] }, QueryLoad_Shouts_ByArgs>(
    loadShoutsByQuery,
    (args: QueryLoad_Shouts_ByArgs) => args,
    true // Включаем кеширование для публичных статей
  )(args)

  return async () => {
    const response = await loader()
    const shouts = response?.load_shouts_by || []

    return shouts
  }
}

/**
 * Реактивный ресурс для загрузки шаутов с кешированием
 * Оптимизирован для публичного контента
 */
export const useShoutsResource = (args: QueryLoad_Shouts_ByArgs) => {
  return createCacheableQueryResource<{ load_shouts_by: Shout[] }, QueryLoad_Shouts_ByArgs>(
    loadShoutsByQuery,
    (args: QueryLoad_Shouts_ByArgs) => args,
    true, // Включаем кеширование
    defaultClient,
    true // withAbort
  )(args)
}

/**
 * Поиск статей с кешированием результатов
 */
export const loadShoutsSearch = (args: QueryLoad_Shouts_SearchArgs) => {
  console.log('[loadShoutsSearch] Creating loader with args:', args)
  const loader = createCacheableLoader<{ load_shouts_search: Shout[] }, QueryLoad_Shouts_SearchArgs>(
    loadShoutsSearchQuery,
    (args: QueryLoad_Shouts_SearchArgs) => args,
    false // 🔄 Временно отключаем кеширование для диагностики
  )(args)

  return async () => {
    console.log('[loadShoutsSearch] Executing loader...')
    const response = await loader()
    console.log('[loadShoutsSearch] Loader response:', {
      hasResponse: !!response,
      resultCount: response?.load_shouts_search?.length
    })
    return response?.load_shouts_search || []
  }
}

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
export const loadAuthors = (options: QueryLoad_Authors_ByArgs) => {
  const loader = createCacheableLoader<{ load_authors_by: Author[] }, QueryLoad_Authors_ByArgs>(
    loadAuthorsByQuery,
    (options: QueryLoad_Authors_ByArgs) => options,
    true // Включаем кеширование для авторов
  )(options)

  return async () => {
    console.log('[loadAuthors] 🚀 Starting API call with args:', options)
    const response = await loader()
    // console.log('[loadAuthors] 📡 Raw API response:', response)
    console.log('[loadAuthors] ✅ Extracted authors:', response?.load_authors_by?.length || 0, 'authors')
    return response?.load_authors_by || []
  }
}

/**
 * Реактивный ресурс для загрузки авторов с кешированием
 */
export const useAuthorsResource = (options: QueryLoad_Authors_ByArgs) => {
  return createCacheableQueryResource<{ load_authors_by: Author[] }, QueryLoad_Authors_ByArgs>(
    loadAuthorsByQuery,
    (options: QueryLoad_Authors_ByArgs) => options,
    true, // Включаем кеширование
    defaultClient,
    true // withAbort
  )(options)
}

/**
 * Поиск авторов с кешированием
 */
export const loadAuthorsSearch = (options: QueryLoad_Authors_SearchArgs) => {
  const loader = createCacheableLoader<{ load_authors_search: Author[] }, QueryLoad_Authors_SearchArgs>(
    loadAuthorsSearchQuery,
    (options: QueryLoad_Authors_SearchArgs) => options,
    true // Кешируем результаты поиска авторов
  )(options)

  return async () => {
    const response = await loader()
    return response?.load_authors_search || []
  }
}

/**
 * Кешируемый метод для загрузки всех авторов
 * Используется для начальной загрузки и кеширования
 */
export const loadAuthorsAll = () => {
  const loader = createCacheableLoader<{ get_authors_all: Author[] }, void>(
    loadAuthorsAllQuery,
    () => ({}),
    true // Включаем кеширование для списка всех авторов
  )(undefined)

  return async () => {
    console.log('[loadAuthorsAll] 🚀 Starting API call...')
    const response = await loader()
    // console.log('[loadAuthorsAll] 📡 Raw API response:', response)
    console.log('[loadAuthorsAll] ✅ Extracted authors:', response?.get_authors_all?.length || 0, 'authors')
    return response?.get_authors_all || []
  }
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
  return createCacheableQueryResource<{ load_reactions_by: Reaction[] }, QueryLoad_Reactions_ByArgs>(
    loadReactionsByQuery,
    (options) => options,
    true, // Включаем кеширование
    defaultClient,
    true // withAbort
  )(options)
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
  return createCacheableQueryResource<{ get_shout: Shout }, QueryGet_ShoutArgs>(
    getShoutQuery,
    () => options,
    true, // Включаем кеширование для статей
    defaultClient,
    true // withAbort
  )(options)
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
  return createCacheableQueryResource<{ get_author: Author }, QueryGet_AuthorArgs>(
    getAuthorQuery,
    () => options,
    true, // Включаем кеширование для авторов
    defaultClient,
    true // withAbort
  )(options)
}

// Unrated Shouts API (НЕ кешируются - требуют актуальных данных для модерации)
/**
 * Реактивный ресурс для загрузки неоцененных шаутов БЕЗ кеширования
 * Используется в FeedView для показа контента требующего модерации
 */
export const useUnratedShouts = (options: LoadShoutsOptions) => {
  return createCacheableQueryResource<{ load_shouts_unrated: Shout[] }, LoadShoutsOptions>(
    loadShoutsUnratedQuery,
    (options) => ({ options }),
    false, // НЕ кешируем неоцененные шауты
    defaultClient,
    true // withAbort
  )(options)
}

/**
 * Прямой метод без кеширования для загрузки неоцененных статей
 * Используется для SSR и начальной загрузки данных
 */
export const loadUnratedShouts = (options: LoadShoutsOptions) => {
  const loader = createLoader<{ load_shouts_unrated: Shout[] }, LoadShoutsOptions>(
    loadShoutsUnratedQuery,
    (options: LoadShoutsOptions) => ({ options }) as QueryLoad_Shouts_UnratedArgs
  )(options)

  return async () => {
    const response = await loader()
    return response?.load_shouts_unrated || []
  }
}

// Topic Authors API (кешируется)
/**
 * Кешируемая загрузка авторов по топику
 */
export const loadTopicAuthors = (args: QueryGet_AuthorArgs) => {
  const loader = createCacheableLoader<{ get_topic_authors: Author[] }, QueryGet_AuthorArgs>(
    getAuthorsByTopicQuery,
    () => args,
    true // Кешируем авторов по топику
  )(args)

  return async () => {
    console.log('[loadTopicAuthors] Loading authors for topic:', args.slug)
    const response = await loader()
    console.log('[loadTopicAuthors] Response:', {
      hasResponse: !!response,
      authorsCount: response?.get_topic_authors?.length || 0
    })
    return response?.get_topic_authors || []
  }
}

/**
 * Кешируемая загрузка подписчиков топика
 */
export const loadTopicFollowers = (args: QueryGet_AuthorArgs) => {
  const loader = createCacheableLoader<{ get_topic_followers: Author[] }, QueryGet_AuthorArgs>(
    getFollowersByTopicQuery,
    () => args,
    true // Кешируем подписчиков топика
  )(args)

  return async () => {
    console.log('[loadTopicFollowers] Loading followers for topic:', args.slug)
    const response = await loader()
    console.log('[loadTopicFollowers] Response:', {
      hasResponse: !!response,
      followersCount: response?.get_topic_followers?.length || 0
    })
    return response?.get_topic_followers || []
  }
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

// ✅ Legacy API удален - используйте useShout и useAuthor

/**
 * SSR-специфичный метод для загрузки данных автора
 * Используется в route.load и контекстах провайдеров
 * @SSR_ONLY Не используйте в компонентах - используйте useAuthor
 */
export const getAuthor = (options: QueryGet_AuthorArgs) => {
  return async () => {
    console.log('[getAuthor] API call with options:', options)
    const resp = await defaultClient.query(getAuthorQuery, options).toPromise()

    // 🔍 ДИАГНОСТИКА: Детальный анализ ответа от GraphQL
    console.log('[getAuthor] Raw GraphQL response:', {
      hasData: !!resp?.data,
      hasAuthor: !!resp?.data?.get_author,
      errors: resp?.error,
      fullResponse: resp
    })

    const author = resp?.data?.get_author || null

    if (author) {
      console.log('[getAuthor] API response author details:', {
        requestedSlug: options.slug,
        returnedSlug: author.slug,
        authorId: author.id,
        authorName: author.name,
        isSlugMatch: author.slug === options.slug
      })

      // 🚨 КРИТИЧНО: Проверяем соответствие slug
      if (author.slug !== options.slug) {
        console.error('[getAuthor] SLUG MISMATCH - API returned wrong author!', {
          requested: options.slug,
          received: author.slug,
          authorId: author.id,
          authorName: author.name
        })
      }
    } else {
      console.log('[getAuthor] API response: null (author not found)')
    }

    return author
  }
}

/**
 * SSR-специфичный метод для загрузки данных статьи
 * Используется в route.load и контекстах провайдеров
 * @SSR_ONLY Не используйте в компонентах - используйте useShout
 */
export const getShout = (options: QueryGet_ShoutArgs) => {
  return async () => {
    const resp = await defaultClient.query(getShoutQuery, options).toPromise()
    return resp?.data?.get_shout || null
  }
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
  const loader = createCacheableLoader<{ get_topic: Topic }, QueryGet_TopicArgs>(
    topicBySlugQuery,
    (args: QueryGet_TopicArgs) => args,
    false // Временно отключаем кеширование для отладки
  )({ slug })

  return async () => {
    // Временная отладка
    console.log(`[loadTopicBySlug] Loading topic: "${slug}"`)
    try {
      const response = await loader()
      console.log(`[loadTopicBySlug] Raw response for "${slug}":`, response)
      console.log(`[loadTopicBySlug] Parsed response for "${slug}":`, {
        hasResponse: !!response,
        hasTopic: !!response?.get_topic,
        topicTitle: response?.get_topic?.title,
        topicStat: response?.get_topic?.stat,
        fullTopic: response?.get_topic
      })
      return response?.get_topic || null
    } catch (error) {
      console.error(`[loadTopicBySlug] Error loading topic "${slug}":`, error)
      return null
    }
  }
}

/**
 * Реактивный ресурс для загрузки топика по slug с кешированием
 * Оптимизирован для публичных топиков
 */
export const useTopicBySlug = (slug: string) => {
  return createCacheableQueryResource<{ get_topic: Topic }, QueryGet_TopicArgs>(
    topicBySlugQuery,
    () => ({ slug }),
    true, // Включаем кеширование
    defaultClient,
    true // withAbort
  )({ slug })
}

// Проверяю содержимое для понимания как обойти кеш
