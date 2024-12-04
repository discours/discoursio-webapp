import { Client } from '@urql/core'
import { createResource } from 'solid-js'
import loadShoutsBookmarkedQuery from '~/graphql/query/core/articles-load-bookmarked'
import loadShoutsCoauthoredQuery from '~/graphql/query/core/articles-load-coauthored'
import loadShoutsDiscussedQuery from '~/graphql/query/core/articles-load-discussed'
import loadShoutsFeedQuery from '~/graphql/query/core/articles-load-feed'
import loadArticlesMyRatesQuery from '~/graphql/query/core/articles-myrates'
import loadCommentsMyRatesQuery from '~/graphql/query/core/comments-myrates'
import loadCommunitiesFollowedQuery from '~/graphql/query/core/communities-followed-by'
import loadReactionsByQuery from '~/graphql/query/core/reactions-load-by'
import {
  Community,
  LoadShoutsOptions,
  QueryLoad_Shouts_BookmarkedArgs,
  QueryLoad_Shouts_CoauthoredArgs,
  QueryLoad_Shouts_DiscussedArgs,
  QueryLoad_Shouts_FeedArgs,
  Reaction,
  ReactionBy,
  ReactionKind,
  Shout
} from '~/graphql/schema/core.gen'

type ResourceArgs<T> = readonly [T, Client | undefined]

/**
 * Реактивный ресурс для загрузки ленты подписок
 * Особенности:
 * - Автоматическое обновление при изменении options/client
 * - Поддержка пагинации через options
 * - Требует авторизованного клиента
 *
 * @example
 * ```tsx
 * // В FeedView:
 * const [feed] = useFollowedShouts({
 *   options: {
 *     limit: FEED_PAGE_SIZE,
 *     offset: page() * FEED_PAGE_SIZE,
 *     filters: { featured: true }
 *   }
 * }, signedClient)
 *
 * // С обработкой состояний:
 * return (
 *   <Show when={!feed.loading} fallback={<FeedSkeleton />}>
 *     <Show when={!feed.error} fallback={<ErrorView error={feed.error} />}>
 *       <For each={feed()}>{shout =>
 *         <ArticleCard shout={shout} />
 *       }</For>
 *     </Show>
 *   </Show>
 * )
 * ```
 */
export const useFollowedShouts = (
  { options }: QueryLoad_Shouts_FeedArgs,
  signedClient: Client | undefined
) => {
  return createResource(
    () => [options, signedClient] as ResourceArgs<LoadShoutsOptions>,
    async ([opts, client]) => {
      if (!(client && opts)) return
      const resp = await client.query(loadShoutsFeedQuery, { ...opts }).toPromise()
      return resp?.data?.load_shouts_feed as Shout[]
    }
  )
}

/**
 * Реактивный ресурс для загрузки закладок пользователя
 * Особенности:
 * - Автоматическое обновление при изменении options/client
 * - Поддержка пагинации через options
 * - Требует авторизованного клиента
 */
export const useBookmarkedShouts = (
  { options }: QueryLoad_Shouts_BookmarkedArgs,
  signedClient: Client | undefined
) => {
  return createResource(
    () => [options, signedClient] as ResourceArgs<LoadShoutsOptions>,
    async ([opts, client]) => {
      if (!(client && opts)) return
      const resp = await client.query(loadShoutsBookmarkedQuery, { options: opts }).toPromise()
      return resp?.data?.load_shouts_bookmarked as Shout[]
    }
  )
}

/**
 * Реактивный ресурс для загрузки статей, в обсуждениях которых участвует пользователь
 * Особенности:
 * - Автоматическое обновление при изменении options/client
 * - Поддержка пагинации через options
 * - Требует авторизованного клиента
 */
export const useDiscussedShouts = (
  { options }: QueryLoad_Shouts_DiscussedArgs,
  signedClient: Client | undefined
) => {
  return createResource(
    () => [options, signedClient] as ResourceArgs<LoadShoutsOptions>,
    async ([opts, client]) => {
      if (!(client && opts)) return
      const resp = await client.query(loadShoutsDiscussedQuery, { options: opts }).toPromise()
      return resp?.data?.load_shouts_discussed as Shout[]
    }
  )
}

/**
 * Реактивный ресурс для загрузки статей соавторства
 * Особенности:
 * - Автоматическое обновление при изменении options/client
 * - Поддержка пагинации через options
 * - Требует авторизованного клиента
 */
export const useCoauthoredShouts = (
  { options }: QueryLoad_Shouts_CoauthoredArgs,
  signedClient: Client | undefined
) => {
  return createResource(
    () => [options, signedClient] as ResourceArgs<LoadShoutsOptions>,
    async ([opts, client]) => {
      if (!(client && opts)) return
      const resp = await client.query(loadShoutsCoauthoredQuery, { options: opts }).toPromise()
      return resp?.data?.load_shouts_coauthored as Shout[]
    }
  )
}

/**
 * Реактивный ресурс для загрузки оценок пользователя
 * Особенности:
 * - Автоматическое обновление при изменении shoutIds/client
 * - Группировка запросов по ID статей
 * - Требует авторизованного клиента
 *
 * @example
 * ```tsx
 * // В ArticleRatings:
 * const [myRates] = useShoutsMyRates([shout1.id, shout2.id], signedClient)
 *
 * // Использование с createEffect:
 * createEffect(() => {
 *   const rates = myRates()
 *   if (rates) {
 *     rates.forEach(rate => {
 *       setShoutRating(rate.shout_id, rate.my_rate)
 *     })
 *   }
 * })
 * ```
 */
export const useShoutsMyRates = (shoutIds: number[], client?: Client) => {
  return createResource(
    () => [shoutIds, client] as ResourceArgs<number[]>,
    async ([ids, cl]) => {
      if (!(cl && ids?.length)) return
      try {
        const response = await cl.query(loadArticlesMyRatesQuery, { shouts: ids }).toPromise()
        if (response.error) return undefined
        return response.data?.get_my_rates_shouts
      } catch (error) {
        console.error('[API] loadShoutsMyRates caught error:', error)
        return undefined
      }
    }
  )
}

/**
 * Реактивный ресурс для загрузки оценок комментариев
 * Особенности:
 * - Автоматическое обновление при изменении commentIds/client
 * - Группировка запросов по ID комментариев
 * - Требует авторизованного клиента
 */
export const useCommentsMyRates = (comments: number[], signedClient: Client | undefined) => {
  type RateResult = { comment: number; my_rate: ReactionKind }

  return createResource(
    () => [comments, signedClient] as ResourceArgs<number[]>,
    async ([ids, client]) => {
      if (!(client && ids?.length)) return
      const resp = await client.query(loadCommentsMyRatesQuery, { comments: ids }).toPromise()
      return resp?.data?.get_my_rates_comments as RateResult[]
    }
  )
}

/**
 * Реактивный ресурс для загрузки реакций
 * Особенности:
 * - Автоматическое обновление при изменении параметров
 * - Поддержка пагинации и фильтрации
 * - Требует авторизованного клиента
 */
export const useReactions = (by: ReactionBy, limit?: number, offset?: number, signedClient?: Client) => {
  return createResource(
    () =>
      [{ by, limit, offset }, signedClient] as ResourceArgs<{
        by: ReactionBy
        limit?: number
        offset?: number
      }>,
    async ([opts, client]) => {
      if (!(client && opts)) return
      const resp = await client.query(loadReactionsByQuery, opts).toPromise()
      return resp?.data?.load_reactions_by as Reaction[]
    }
  )
}

/**
 * Реактивный ресурс для загрузки сообществ, на которые подписан пользователь
 * Особенности:
 * - Автоматическое обновление при изменении параметров
 * - Поддержка загрузки по slug/id
 * - Требует авторизованного клиента
 */
export const useFollowedCommunities = (
  slug?: string,
  user?: string,
  authorId?: number,
  signedClient?: Client
) => {
  return createResource(
    () =>
      [{ slug, user, author_id: authorId }, signedClient] as ResourceArgs<{
        slug?: string
        user?: string
        author_id?: number
      }>,
    async ([opts, client]) => {
      if (!(client && opts)) return
      const resp = await client.query(loadCommunitiesFollowedQuery, opts).toPromise()
      return resp?.data?.get_communities_by_author as Community[]
    }
  )
}

// @deprecated Legacy API
// будет удалено в следующих версиях

/**
 * @deprecated Используйте useFollowedShouts вместо loadFollowedShouts
 * Пример миграции:
 * ```tsx
 * // Было в FeedView:
 * const feedLoader = loadFollowedShouts({
 *   options: { limit: 20 }
 * }, client)
 * const feed = await feedLoader()
 *
 * // Стало:
 * const [feed] = useFollowedShouts({
 *   options: { limit: 20 }
 * }, signedClient)
 * <For each={feed()}>{shout =>
 *   <ArticleCard shout={shout} />
 * }</For>
 * ```
 */
export const loadFollowedShouts = (
  { options }: QueryLoad_Shouts_FeedArgs,
  signedClient: Client | undefined
) => {
  return async () => {
    if (!signedClient) return undefined
    const resp = await signedClient.query(loadShoutsFeedQuery, { ...options }).toPromise()
    return resp?.data?.load_shouts_feed as Shout[]
  }
}

/**
 * @deprecated Используйте useDiscussedShouts вместо loadDiscussedShouts
 * Пример миграции:
 * ```tsx
 * // Было в FeedView:
 * const discussedLoader = loadDiscussedShouts({
 *   options: { limit: FEED_PAGE_SIZE }
 * }, client)
 * const discussed = await discussedLoader()
 *
 * // Стало:
 * const [discussed] = useDiscussedShouts({
 *   options: { limit: FEED_PAGE_SIZE }
 * }, signedClient)
 * <For each={discussed()}>{shout =>
 *   <ArticleCard shout={shout} />
 * }</For>
 * ```
 */
export const loadDiscussedShouts = (
  { options }: QueryLoad_Shouts_DiscussedArgs,
  signedClient: Client | undefined
) => {
  return async () => {
    if (!signedClient) return undefined
    const resp = await signedClient.query(loadShoutsDiscussedQuery, { options }).toPromise()
    return resp?.data?.load_shouts_discussed as Shout[]
  }
}

/**
 * @deprecated Используйте useCoauthoredShouts вместо loadCoauthoredShouts
 * Пример миграции:
 * ```tsx
 * // Было в FeedView:
 * const coauthoredLoader = loadCoauthoredShouts({
 *   options: { limit: FEED_PAGE_SIZE }
 * }, client)
 * const coauthored = await coauthoredLoader()
 *
 * // Стало:
 * const [coauthored] = useCoauthoredShouts({
 *   options: { limit: FEED_PAGE_SIZE }
 * }, signedClient)
 * <For each={coauthored()}>{shout =>
 *   <ArticleCard shout={shout} />
 * }</For>
 * ```
 */
export const loadCoauthoredShouts = (
  { options }: QueryLoad_Shouts_CoauthoredArgs,
  signedClient: Client | undefined
) => {
  return async () => {
    if (!signedClient) return undefined
    const resp = await signedClient.query(loadShoutsCoauthoredQuery, { options }).toPromise()
    return resp?.data?.load_shouts_coauthored as Shout[]
  }
}

/**
 * @deprecated Используйте useCommentsMyRates вместо loadCommentsMyRates
 * Пример миграции:
 * ```tsx
 * // Было в Comment.tsx:
 * const commentsRatesFetcher = loadCommentsMyRates(
 *   comments.map(c => c.id),
 *   client
 * )
 * const myratesData = await commentsRatesFetcher()
 *
 * // Стало:
 * const [myRates] = useCommentsMyRates(
 *   comments().map(c => c.id),
 *   signedClient
 * )
 * createEffect(() => {
 *   const rates = myRates()
 *   rates?.forEach(rate => updateRating(rate))
 * })
 * ```
 */
export const loadCommentsMyRates = (comments: number[], signedClient: Client | undefined) => {
  return async () => {
    if (!signedClient) return undefined
    const resp = await signedClient.query(loadCommentsMyRatesQuery, { comments }).toPromise()
    return resp?.data?.get_my_rates_comments as { comment: number; my_rate: ReactionKind }[]
  }
}

/**
 * @deprecated Используйте useShoutsMyRates вместо loadShoutsMyRates
 * Пример миграции:
 * ```tsx
 * // Было в FeedView:
 * const ratesLoader = loadShoutsMyRates(
 *   shouts.map(s => s.id),
 *   client
 * )
 * const rates = await ratesLoader()
 *
 * // Стало:
 * const [myRates] = useShoutsMyRates(
 *   shouts().map(s => s.id),
 *   signedClient
 * )
 * createEffect(() => {
 *   const rates = myRates()
 *   rates?.forEach(rate => updateRating(rate))
 * })
 * ```
 */
export const loadShoutsMyRates = (shoutIds: number[], client?: Client) => {
  return async () => {
    if (!client) return undefined
    try {
      const response = await client.query(loadArticlesMyRatesQuery, { shouts: shoutIds }).toPromise()
      if (response.error) return undefined
      return response.data?.get_my_rates_shouts
    } catch (error) {
      console.error('[API] loadShoutsMyRates caught error:', error)
      return undefined
    }
  }
}
