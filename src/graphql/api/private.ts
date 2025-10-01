import { Client } from '@urql/core'
import { createResource } from 'solid-js'
import { createQueryResource, defaultClient, ResourceArgs } from '~/graphql/client'
import {
  Community,
  LoadShoutsOptions,
  QueryLoad_Shouts_BookmarkedArgs,
  QueryLoad_Shouts_ByArgs,
  QueryLoad_Shouts_CoauthoredArgs,
  QueryLoad_Shouts_DiscussedArgs,
  Reaction,
  ReactionBy,
  Shout
} from '~/graphql/generated/graphql'
import loadShoutsBookmarkedQuery from '~/graphql/query/core/articles-load-bookmarked'
import loadShoutsCoauthoredQuery from '~/graphql/query/core/articles-load-coauthored'
import loadShoutsDiscussedQuery from '~/graphql/query/core/articles-load-discussed'
import loadShoutsFeedQuery from '~/graphql/query/core/articles-load-feed'
import loadShoutsFollowedByQuery from '~/graphql/query/core/articles-load-followed-by'
import loadArticlesMyRatesQuery from '~/graphql/query/core/articles-myrates'
import loadCommentsMyRatesQuery from '~/graphql/query/core/comments-myrates'
import loadCommunitiesFollowedQuery from '~/graphql/query/core/communities-followed-by'
import loadReactionsByQuery from '~/graphql/query/core/reactions-load-by'

/**
 * Реактивный ресурс для загрузки ленты подписок
 * Кешируемый метод с автоматическим обновлением при изменении параметров
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
export const useFollowedShouts = createQueryResource(
  loadShoutsFeedQuery,
  ({ options }: QueryLoad_Shouts_ByArgs) => ({ ...options }),
  defaultClient
)

/**
 * Реактивный ресурс для загрузки закладок пользователя
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Особенности:
 * - Автоматическое обновление при изменении options/client
+ *
+ * @example
+ * ```tsx
+ * const [bookmarks] = useBookmarkedShouts({
+ *   options: { 
+ *     limit: FEED_PAGE_SIZE,
+ *     offset: page() * FEED_PAGE_SIZE
+ *   }
+ * }, signedClient)
+ * 
+ * return (
+ *   <Show when={bookmarks()} fallback={<Loading />}>
+ *     <For each={bookmarks()}>{shout =>
+ *       <ArticleCard shout={shout} />
+ *     }</For>
+ *   </Show>
+ * )
+ * ```
 */
export const useBookmarkedShouts = ({ options }: QueryLoad_Shouts_BookmarkedArgs, signedClient: Client | undefined) => {
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
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Особенности:
 * - Автоматическое обновление при изменении options/client
+ *
+ * @example
+ * ```tsx
+ * const [discussed] = useDiscussedShouts({
+ *   options: { limit: FEED_PAGE_SIZE }
+ * }, signedClient)
+ * 
+ * <For each={discussed()}>{shout =>
+ *   <ArticleCard shout={shout} />
+ * }</For>
+ * ```
 */
export const useDiscussedShouts = ({ options }: QueryLoad_Shouts_DiscussedArgs, signedClient: Client | undefined) => {
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
 * Кешируемый метод с автоматическим обновленим при изменении параметров
 * Особенности:
 * - Автоматическое обновление при изменении options/client
 */
export const useCoauthoredShouts = ({ options }: QueryLoad_Shouts_CoauthoredArgs, signedClient: Client | undefined) => {
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
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Особенности:
 * - Автоматическое обновление при изменении shoutIds/client
+ *
+ * @example
+ * ```tsx
+ * // В ArticleRatings:
+ * const [myRates] = useShoutsMyRates([shout1.id, shout2.id], signedClient)
+ *
+ * // Использование с createEffect:
+ * createEffect(() => {
+ *   const rates = myRates()
+ *   if (rates) {
+ *     rates.forEach(rate => {
+ *       setShoutRating(rate.shout_id, rate.my_rate)
+ *     })
+ *   }
+ * })
+ * ```
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
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Особенности:
 * - Автоматическое обновление при изменении commentIds/client
 */
export const useCommentsMyRates = (comments: number[], signedClient: Client | undefined) => {
  return createResource(
    () => [comments, signedClient] as ResourceArgs<number[]>,
    async ([ids, client]) => {
      if (!(client && ids?.length)) return
      const resp = await client.query(loadCommentsMyRatesQuery, { comments: ids }).toPromise()
      return resp?.data?.get_my_rates_comments
    }
  )
}

/**
 * Реактивный ресурс для загрузки реакций
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Особенности:
 * - Автоматическое обновление при изменении параметров
+ *
+ * @example
+ * ```tsx
+ * const [reactions] = useReactions(
+ *   { kinds: [ReactionKind.Comment] },
+ *   10, // limit
+ *   0   // offset
+ * )
+ * 
+ * <For each={reactions()}>{reaction =>
+ *   <ReactionItem reaction={reaction} />
+ * }</For>
+ * ```
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
 * Реактивный ресурс для загрузки сообществ
 * Кешируемый метод с автоматическим обновлением при изменении параметров
 * Особенности:
 * - Автоматическое обновление при изменении параметров
 */
export const useFollowedCommunities = (slug?: string, authorId?: number, signedClient?: Client) => {
  return createResource(
    () =>
      [{ slug, author_id: authorId }, signedClient] as ResourceArgs<{
        slug?: string
        author_id?: number
      }>,
    async ([opts, client]) => {
      if (!(client && opts)) return
      const resp = await client.query(loadCommunitiesFollowedQuery, opts).toPromise()
      return resp?.data?.get_communities_by_author as Community[]
    }
  )
}

/**
 * Прямой метод без кеширования
 * Загрузка СВОЕЙ ленты подписок (текущего пользователя)
 * Загружает публикации только от авторов/тем, на которых подписан ТЕКУЩИЙ пользователь
 */
export const loadMyFollowedShouts = ({ options }: { options: LoadShoutsOptions }, signedClient: Client | undefined) => {
  return async () => {
    if (!signedClient) {
      console.log('[loadMyFollowedShouts] Missing auth client')
      return undefined
    }
    console.log('[loadMyFollowedShouts] Loading MY followed shouts with options:', options)
    const resp = await signedClient.query(loadShoutsFeedQuery, { options }).toPromise()
    const result = resp?.data?.load_shouts_feed as Shout[]
    console.log('[loadMyFollowedShouts] Result:', { count: result?.length, hasError: !!resp?.error })
    if (resp?.error) {
      console.error('[loadMyFollowedShouts] GraphQL error:', resp.error)
    }
    return result
  }
}

/**
 * Прямой метод без кеширования
 * Загрузка ленты подписок ДРУГОГО пользователя
 * Используется для SSR и начальной загрузки
 * Загружает публикации только от авторов/тем, на которых подписан ДРУГОЙ пользователь
 */
export const loadFollowedShouts = (
  { options, slug }: { options: LoadShoutsOptions; slug: string },
  signedClient: Client | undefined
) => {
  return async () => {
    if (!signedClient || !slug) {
      console.log('[loadFollowedShouts] Missing client or slug:', { hasClient: !!signedClient, slug })
      return undefined
    }
    console.log('[loadFollowedShouts] Loading followed shouts for user:', slug, 'with options:', options)
    const resp = await signedClient.query(loadShoutsFollowedByQuery, { slug, options }).toPromise()
    const result = resp?.data?.load_shouts_followed_by as Shout[]
    console.log('[loadFollowedShouts] Result:', { count: result?.length, hasError: !!resp?.error })
    if (resp?.error) {
      console.error('[loadFollowedShouts] GraphQL error:', resp.error)
    }
    return result
  }
}

/**
 * Загрузка обсуждаемых статей
 * Используется для SSR и начальной загрузки
 */
export const loadDiscussedShouts = ({ options }: QueryLoad_Shouts_DiscussedArgs, signedClient: Client | undefined) => {
  return async () => {
    if (!signedClient) return undefined
    const resp = await signedClient.query(loadShoutsDiscussedQuery, { options }).toPromise()
    return resp?.data?.load_shouts_discussed as Shout[]
  }
}

/**
 * Загрузка статей соавторства
 * Используется для SSR и начальной загрузки
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

// ✅ Legacy API удален - используйте useCommentsMyRates и useShoutsMyRates
