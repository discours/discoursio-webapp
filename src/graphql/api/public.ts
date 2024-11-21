import { cache } from '@solidjs/router'
import { Client, defaultClient } from '~/graphql/client'
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
import {
  Author,
  LoadShoutsOptions,
  QueryGet_AuthorArgs,
  QueryGet_ShoutArgs,
  QueryGet_Topic_AuthorsArgs,
  QueryGet_Topic_FollowersArgs,
  QueryLoad_Authors_ByArgs,
  QueryLoad_Reactions_ByArgs,
  QueryLoad_Shouts_ByArgs,
  QueryLoad_Shouts_SearchArgs,
  QueryLoad_Shouts_UnratedArgs,
  Reaction,
  Shout,
  Topic
} from '~/graphql/schema/core.gen'

export const loadTopics = () =>
  cache(async () => {
    const resp = await defaultClient.query(loadTopicsQuery, {}).toPromise()
    const result = resp?.data?.get_topics_all
    if (result) return result as Topic[]
  }, 'topics')

export const loadAuthors = (options: QueryLoad_Authors_ByArgs) => {
  const page = `${options.offset || 0}-${(options.limit || 0) + (options.offset || 0)}`
  const filter = new URLSearchParams(options.by as Record<string, string>)
  return cache(async () => {
    const resp = await defaultClient.query(loadAuthorsByQuery, { ...options }).toPromise()
    const result = resp?.data?.load_authors_by
    if (result) return result as Author[]
  }, `authors-${filter}-${page}`)
}

export const loadAuthorsAll = () => {
  return cache(async () => {
    const resp = await defaultClient.query(loadAuthorsAllQuery, {}).toPromise()
    const result = resp?.data?.get_authors_all
    if (result) return result as Author[]
  }, 'authors-all')
}

export const loadShouts = (args: QueryLoad_Shouts_ByArgs) => {
  const { options } = args
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  const filter = new URLSearchParams(options?.filters as Record<string, string>)
  return cache(async () => {
    const resp = await defaultClient.query(loadShoutsByQuery, args).toPromise()
    const result = resp?.data?.load_shouts_by
    if (result) return result as Shout[]
  }, `shouts-${filter}-${page}`)
}

export const loadReactions = (options: QueryLoad_Reactions_ByArgs, authorizedClient?: Client) => {
  if (!options.by) {
    console.debug(options)
    throw new Error('[api] wrong loadReactions call')
  }
  const kind = (options.by.kinds || []).join('-')
  const allorone = options.by?.shout ? `shout-${options.by.shout}` : 'all'
  const page = `${options.offset || 0}-${(options?.limit || 0) + (options.offset || 0)}`
  const filter = new URLSearchParams(options.by as Record<string, string>)
  // console.debug(options)
  return cache(async () => {
    const resp = await (authorizedClient || defaultClient).query(loadReactionsByQuery, options).toPromise()
    const result = resp?.data?.load_reactions_by
    if (result) return result as Reaction[]
  }, `${allorone}-${kind}-${filter}-${page}`)
}

export const getShout = (options: QueryGet_ShoutArgs) => {
  // console.debug('[lib.api] get shout options', options)
  return cache(
    async () => {
      const resp = await defaultClient.query(getShoutQuery, options).toPromise()
      const result = resp?.data?.get_shout
      if (result) return result as Shout
    },
    `shout-${options?.slug || ''}`
  )
}

export const getAuthor = (options: QueryGet_AuthorArgs) => {
  return cache(
    async () => {
      const resp = await defaultClient.query(getAuthorQuery, options).toPromise()
      const result = resp?.data?.get_author
      if (result) return result as Author
    },
    `author-${options?.slug || options?.author_id}`
  )
}

export const loadShoutsSearch = (text: string, options: LoadShoutsOptions) => {
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  return cache(async () => {
    const resp = await defaultClient
      .query(loadShoutsSearchQuery, { text, options } as QueryLoad_Shouts_SearchArgs)
      .toPromise()
    const result = resp?.data?.load_shouts_search
    if (result) return result as Shout[]
  }, `search-${text}-${page}`)
}

export const getFollowersByTopic = (slug: string) => {
  // TODO: paginate topic followers
  return cache(async () => {
    const resp = await defaultClient
      .query(getFollowersByTopicQuery, { slug } as QueryGet_Topic_FollowersArgs)
      .toPromise()
    const result = resp?.data?.get_topic_followers
    if (result) return result as Author[]
  }, `topic-${slug}`)
}

export const getAuthorsByTopic = (slug: string) => {
  return cache(async () => {
    const resp = await defaultClient
      .query(getAuthorsByTopicQuery, { slug } as QueryGet_Topic_AuthorsArgs)
      .toPromise()
    const result = resp?.data?.get_topic_authors
    if (result) return result as Author[]
  }, `author-${slug}`)
}

export const loadUnratedShouts = (options: LoadShoutsOptions) => {
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  return cache(async () => {
    const resp = await defaultClient
      .query(loadShoutsUnratedQuery, { options } as QueryLoad_Shouts_UnratedArgs)
      .toPromise()
    const result = resp?.data?.load_shouts_unrated
    if (result) return result as Shout[]
  }, `shouts-unrated-${page}`)
}
