import { createServer } from 'node:http'

const arrayFields = [
  'get_author_followers',
  'get_author_follows_authors',
  'get_author_follows_topics',
  'get_authors_all',
  'get_communities_all',
  'get_communities_by_author',
  'get_my_rates_comments',
  'get_my_rates_shouts',
  'get_shout_followers',
  'get_topic_authors',
  'get_topic_followers',
  'get_topics_all',
  'get_topics_by_author',
  'get_topics_by_community',
  'load_authors_by',
  'load_authors_search',
  'load_comments_branch',
  'load_reactions_by',
  'load_shout_comments',
  'load_shout_ratings',
  'load_shouts_authored_by',
  'load_shouts_bookmarked',
  'load_shouts_by',
  'load_shouts_coauthored',
  'load_shouts_discussed',
  'load_shouts_feed',
  'load_shouts_followed_by',
  'load_shouts_random_top',
  'load_shouts_search',
  'load_shouts_unrated',
  'load_shouts_with_topic'
]

const nullableFields = ['get_author', 'get_author_id', 'get_community', 'get_shout', 'get_topic']

export function demoData() {
  const data = Object.fromEntries(arrayFields.map((field) => [field, []]))
  for (const field of nullableFields) data[field] = null

  return {
    __typename: 'Query',
    ...data,
    get_author_follows: { error: null },
    get_my_shout: { error: 'Demo mode is read-only', shout: null },
    get_shouts_drafts: { drafts: [], error: null },
    getSession: { author: null, error: null, success: false, token: null },
    isEmailUsed: false,
    load_drafts: { drafts: [], error: null },
    load_notifications: { error: null, notifications: [], unread: 0 },
    sendLink: { id: null }
  }
}

export function createDemoApiServer() {
  return createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Headers', 'content-type')
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('X-Content-Type-Options', 'nosniff')

    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }

    if (request.method !== 'POST' || request.url?.split('?')[0] !== '/graphql') {
      response.writeHead(404)
      response.end('{"error":"Not found"}')
      return
    }

    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > 1_000_000) request.destroy()
    })
    request.on('end', () => {
      response.writeHead(200)
      response.end(JSON.stringify({ data: demoData() }))
    })
  })
}
