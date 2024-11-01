import { cache } from '@solidjs/router'
import { Client } from '@urql/core'
import loadShoutsBookmarkedQuery from '~/graphql/query/core/articles-load-bookmarked'
import loadShoutsCoauthoredQuery from '~/graphql/query/core/articles-load-coauthored'
import loadShoutsDiscussedQuery from '~/graphql/query/core/articles-load-discussed'
import loadShoutsFeedQuery from '~/graphql/query/core/articles-load-feed'
import {
  QueryLoad_Shouts_BookmarkedArgs,
  QueryLoad_Shouts_CoauthoredArgs,
  QueryLoad_Shouts_DiscussedArgs,
  QueryLoad_Shouts_FeedArgs,
  Shout
} from '~/graphql/schema/core.gen'

export const loadFollowedShouts = (
  signedClient: Client | undefined,
  { options }: QueryLoad_Shouts_FeedArgs
) => {
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  return cache(async () => {
    const resp = await signedClient?.query(loadShoutsFeedQuery, { ...options }).toPromise()
    const result = resp?.data?.load_shouts_feed
    if (result) return result as Shout[]
  }, `shouts-feed-${page}`)
}

export const loadBookmarkedShouts = (
  signedClient: Client | undefined,
  { options }: QueryLoad_Shouts_BookmarkedArgs
) => {
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  return cache(async () => {
    const resp = await signedClient?.query(loadShoutsBookmarkedQuery, { ...options }).toPromise()
    const result = resp?.data?.load_shouts_bookmarked
    if (result) return result as Shout[]
  }, `shouts-bookmarked-${page}`)
}

export const loadDiscussedShouts = (
  signedClient: Client | undefined,
  { options }: QueryLoad_Shouts_DiscussedArgs
) => {
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  return cache(async () => {
    const resp = await signedClient?.query(loadShoutsDiscussedQuery, { ...options }).toPromise()
    const result = resp?.data?.load_shouts_discussed
    if (result) return result as Shout[]
  }, `shouts-discussed-${page}`)
}

export const loadCoauthoredShouts = (
  signedClient: Client | undefined,
  { options }: QueryLoad_Shouts_CoauthoredArgs
) => {
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  return cache(async () => {
    const resp = await signedClient?.query(loadShoutsCoauthoredQuery, { ...options }).toPromise()
    const result = resp?.data?.load_shouts_coauthored
    if (result) return result as Shout[]
  }, `shouts-coauthored-${page}`)
}
