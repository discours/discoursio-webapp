import { cache } from '@solidjs/router'
import { Client } from '@urql/core'
import loadShoutsBookmarkedQuery from '~/graphql/query/core/articles-load-bookmarked'
import loadShoutsCoauthoredQuery from '~/graphql/query/core/articles-load-coauthored'
import loadShoutsDiscussedQuery from '~/graphql/query/core/articles-load-discussed'
import loadShoutsFeedQuery from '~/graphql/query/core/articles-load-feed'
import loadArticlesMyRatesQuery from '~/graphql/query/core/articles-myrates'
import loadCommentsMyRatesQuery from '~/graphql/query/core/comments-myrates'
import {
  QueryLoad_Shouts_BookmarkedArgs,
  QueryLoad_Shouts_CoauthoredArgs,
  QueryLoad_Shouts_DiscussedArgs,
  QueryLoad_Shouts_FeedArgs,
  Shout
} from '~/graphql/schema/core.gen'

export const loadFollowedShouts = (
  { options }: QueryLoad_Shouts_FeedArgs,
  signedClient: Client | undefined
) => {
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  return cache(async () => {
    const resp = await signedClient?.query(loadShoutsFeedQuery, { ...options }).toPromise()
    const result = resp?.data?.load_shouts_feed
    if (result) return result as Shout[]
  }, `shouts-feed-${page}`)
}

export const loadBookmarkedShouts = (
  { options }: QueryLoad_Shouts_BookmarkedArgs,
  signedClient: Client | undefined
) => {
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  return cache(async () => {
    const resp = await signedClient?.query(loadShoutsBookmarkedQuery, { options }).toPromise()
    const result = resp?.data?.load_shouts_bookmarked
    if (result) return result as Shout[]
  }, `shouts-bookmarked-${page}`)
}

export const loadDiscussedShouts = (
  { options }: QueryLoad_Shouts_DiscussedArgs,
  signedClient: Client | undefined
) => {
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  return cache(async () => {
    const resp = await signedClient?.query(loadShoutsDiscussedQuery, { options }).toPromise()
    const result = resp?.data?.load_shouts_discussed
    if (result) return result as Shout[]
  }, `shouts-discussed-${page}`)
}

export const loadCoauthoredShouts = (
  { options }: QueryLoad_Shouts_CoauthoredArgs,
  signedClient: Client | undefined
) => {
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  return cache(async () => {
    const resp = await signedClient?.query(loadShoutsCoauthoredQuery, { options }).toPromise()
    const result = resp?.data?.load_shouts_coauthored
    if (result) return result as Shout[]
  }, `shouts-coauthored-${page}`)
}

export const loadArticlesMyRates = (shouts: number[], signedClient: Client | undefined) => {
  return cache(
    async () => {
      const resp = await signedClient?.query(loadArticlesMyRatesQuery, { shouts }).toPromise()
      const result = resp?.data?.articles_myrates
      if (result) return result as Shout[]
    },
    `articles-myrates-${shouts.join('-')}`
  )
}

export const loadCommentsMyRates = (comments: number[], signedClient: Client | undefined) => {
  return cache(
    async () => {
      const resp = await signedClient?.query(loadCommentsMyRatesQuery, { comments }).toPromise()
      const result = resp?.data?.comments_myrates
      if (result) return result as Comment[]
    },
    `comments-myrates-${comments.join('-')}`
  )
}
