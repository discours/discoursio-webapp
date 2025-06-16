/// <reference lib="webworker" />

const CACHE_VERSION = `v${self.CACHE_BUILD_TIME || Date.now()}`
const CDN_URL = 'https://files.dscrs.site'

const CACHES = {
  static: `static-${CACHE_VERSION}`,
  dynamic: `dynamic-${CACHE_VERSION}`,
  pages: `pages-${CACHE_VERSION}`,
  graphql: `graphql-${CACHE_VERSION}`
}

const CACHE_TTL = {
  static: 7 * 24 * 60 * 60 * 1000, // 7 дней
  dynamic: 3 * 24 * 60 * 60 * 1000, // 3 дня
  pages: 1 * 24 * 60 * 60 * 1000, // 1 день
  graphql: 30 * 60 * 1000 // 30 минут
}

const PRECACHE_URLS = ['/', '/offline.html', '/offline.css', '/favicon.ico', '/error.svg']

const CACHEABLE_GRAPHQL_OPERATIONS = [
  'get_topics_by_community',
  'get_topics',
  'get_authors',
  'get_author',
  'load_authors_by',
  'get_shouts',
  'get_shout',
  'load_shouts_by',
  'get_topic_followers',
  'get_topic_authors',
  'load_topic_authors',
  'load_topic_followers',
  'load_shouts_search'
]

// Регулярные выражения для оптимизации производительности
const STATIC_ASSETS_REGEX = /\.(css|js|woff2?|ttf|eot|png|jpg|jpeg|gif|svg|ico)$/
const LOCALIZATION_REGEX = /\/(ru|en)\/translation\.json$/

// Логирование с временными метками
const log = (level, message, ...args) => {
  const timestamp = new Date().toISOString()
  console[level](`[SW ${timestamp}] ${message}`, ...args)
}

// Install event - предварительное кэширование
self.addEventListener('install', (event) => {
  log('info', 'Service Worker installing...')
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHES.static)
        await cache.addAll(PRECACHE_URLS)
        log('info', `Precached ${PRECACHE_URLS.length} URLs`)

        // Регистрируем background sync для черновиков
        if ('serviceWorker' in self && 'sync' in self.registration) {
          await self.registration.sync.register('draft-sync')
          log('info', 'Registered background sync for drafts')
        }
      } catch (error) {
        log('error', 'Failed to precache resources:', error)
      }
      self.skipWaiting()
    })()
  )
})

// Activate event - очистка старых кэшей
self.addEventListener('activate', (event) => {
  log('info', 'Service Worker activating...')
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys()
        const validCacheNames = Object.values(CACHES)

        await Promise.all(
          cacheNames.map(async (cacheName) => {
            if (!validCacheNames.includes(cacheName)) {
              log('info', `Deleting old cache: ${cacheName}`)
              await caches.delete(cacheName)
            }
          })
        )

        await cleanExpiredEntries()
        log('info', 'Service Worker activated and caches cleaned')
      } catch (error) {
        log('error', 'Activation failed:', error)
      }
      self.clients.claim()
    })()
  )
})

// Очистка просроченных записей
const cleanExpiredEntries = async () => {
  try {
    for (const [cacheName, cacheTTL] of Object.entries(CACHE_TTL)) {
      const cache = await caches.open(CACHES[cacheName])
      const requests = await cache.keys()

      let cleanedCount = 0
      await Promise.all(
        requests.map(async (request) => {
          const response = await cache.match(request)
          if (response) {
            const cachedTime = response.headers.get('sw-cached-time')
            if (cachedTime && Date.now() - Number.parseInt(cachedTime) > cacheTTL) {
              await cache.delete(request)
              cleanedCount++
            }
          }
        })
      )

      if (cleanedCount > 0) {
        log('info', `Cleaned ${cleanedCount} expired entries from ${cacheName} cache`)
      }
    }
  } catch (error) {
    log('error', 'Failed to clean expired entries:', error)
  }
}

// Проверка актуальности кэша
const isCacheExpired = (response, ttl) => {
  const cachedTime = response.headers.get('sw-cached-time')
  return !cachedTime || Date.now() - Number.parseInt(cachedTime) > ttl
}

// Создание кэшированного ответа с метаданными
const createCachedResponse = async (response) => {
  const responseClone = response.clone()
  const body = await responseClone.arrayBuffer()

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'sw-cached-time': Date.now().toString(),
      'sw-cache-version': CACHE_VERSION
    }
  })
}

// Стратегия Cache First для статических ресурсов
const cacheFirstStrategy = async (request, cacheName, ttl) => {
  try {
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)

    if (cachedResponse && !isCacheExpired(cachedResponse, ttl)) {
      log('info', `Cache hit: ${request.url}`)
      return cachedResponse
    }

    log('info', `Cache miss or expired: ${request.url}`)
    const networkResponse = await fetch(request)
    const responseToCache = await createCachedResponse(networkResponse)
    await cache.put(request, responseToCache)

    return networkResponse
  } catch (error) {
    log('warn', `Cache first failed for ${request.url}:`, error)
    const cachedResponse = await caches.match(request)
    return cachedResponse || new Response('Resource not available offline', { status: 503 })
  }
}

// Стратегия Network First для динамического контента
const networkFirstStrategy = async (request, cacheName, _ttl) => {
  try {
    log('info', `Network first: ${request.url}`)
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      const responseToCache = await createCachedResponse(networkResponse)
      await cache.put(request, responseToCache)
    }

    return networkResponse
  } catch (error) {
    log('warn', `Network first fallback for ${request.url}:`, error)
    const cachedResponse = await caches.match(request)
    return cachedResponse || new Response('Content not available offline', { status: 503 })
  }
}

// Обработка GraphQL запросов
const handleGraphQLRequest = async (request) => {
  try {
    const requestClone = request.clone()
    const body = await requestClone.json()
    const operationName = body.operationName || 'unknown'

    // Кэшируемые операции
    if (CACHEABLE_GRAPHQL_OPERATIONS.includes(operationName)) {
      const cacheKey = new Request(`${request.url}#${JSON.stringify(body)}`)
      return await cacheFirstStrategy(cacheKey, CACHES.graphql, CACHE_TTL.graphql)
    }

    // Некэшируемые операции (мутации, пользовательский контент)
    log('info', `Non-cacheable GraphQL operation: ${operationName}`)
    const response = await fetch(request)

    // Если это offline режим, возвращаем структурированный ответ
    if (!response.ok && response.status === 0) {
      return new Response(
        JSON.stringify({
          data: null,
          errors: [{ message: 'Network error: operation not available offline' }]
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return response
  } catch (error) {
    log('error', `GraphQL request failed: ${request.url}`, error)

    // Возвращаем структурированный GraphQL error response
    return new Response(
      JSON.stringify({
        data: null,
        errors: [{ message: 'Service Worker: GraphQL operation failed offline' }]
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Основной fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Пропускаем запросы к другим доменам (кроме CDN)
  if (url.origin !== self.location.origin && !url.href.startsWith(CDN_URL)) {
    return
  }

  event.respondWith(
    (async () => {
      // GraphQL запросы
      if (url.pathname === '/graphql' && request.method === 'POST') {
        return await handleGraphQLRequest(request)
      }

      // Статические ресурсы (CSS, JS, шрифты, изображения)
      if (STATIC_ASSETS_REGEX.test(url.pathname)) {
        return await cacheFirstStrategy(request, CACHES.static, CACHE_TTL.static)
      }

      // Отдельная обработка для CDN изображений
      if (url.href.startsWith(CDN_URL)) {
        // Проверяем наличие параметров для обхода кеша
        const hasCacheBuster =
          url.search.includes('v=') ||
          url.search.includes('_k=') ||
          url.search.includes('force_refresh=') ||
          url.search.includes('nocache=') ||
          url.search.includes('reload=')

        if (hasCacheBuster) {
          log('info', `Bypassing cache for versioned CDN resource: ${url.href}`)

          // Полностью пропускаем кеширование и идем напрямую в сеть
          try {
            const networkResponse = await fetch(request, {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                Pragma: 'no-cache'
              }
            })

            if (networkResponse.ok) {
              log('info', `Successfully fetched resource from network: ${url.href}`)
              return networkResponse
            } else {
              log('warn', `Failed to fetch from network (status ${networkResponse.status}): ${url.href}`)
              // Если не удалось получить из сети, пробуем из кеша как запасной вариант
              const cachedResponse = await caches.match(request)
              return cachedResponse || networkResponse
            }
          } catch (error) {
            log('error', `Error fetching resource: ${url.href}`, error)
            // В случае ошибки сети пробуем из кеша
            const cachedResponse = await caches.match(request)
            return cachedResponse || new Response('Resource not available', { status: 503 })
          }
        }

        // Для обычных запросов используем стратегию "сеть первая, затем кеш"
        // с коротким TTL для быстрого обновления
        return await networkFirstStrategy(request, CACHES.dynamic, 60 * 1000) // 1 минута TTL
      }

      // API запросы (feedback, newsletter)
      if (url.pathname.startsWith('/api/')) {
        return await networkFirstStrategy(request, CACHES.dynamic, CACHE_TTL.dynamic)
      }

      // Файлы локализации
      if (LOCALIZATION_REGEX.test(url.pathname)) {
        return await cacheFirstStrategy(request, CACHES.static, CACHE_TTL.static)
      }

      // HTML страницы
      if (
        request.mode === 'navigate' ||
        (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))
      ) {
        try {
          const response = await networkFirstStrategy(request, CACHES.pages, CACHE_TTL.pages)
          return response
        } catch (_error) {
          log('warn', `Navigation failed for ${url.pathname}, serving offline page`)
          return await caches.match('/offline.html')
        }
      }

      // Все остальное - пытаемся сеть, затем кэш
      return await networkFirstStrategy(request, CACHES.dynamic, CACHE_TTL.dynamic)
    })()
  )
})

// Background Sync для черновиков
self.addEventListener('sync', (event) => {
  log('info', `Background sync triggered: ${event.tag}`)

  if (event.tag === 'draft-sync') {
    event.waitUntil(syncDrafts())
  }
})

// Синхронизация черновиков
const syncDrafts = async () => {
  try {
    log('info', 'Starting draft synchronization...')

    // Получаем все черновики из IndexedDB/localStorage
    const drafts = await getAllUnsyncedDrafts()

    if (drafts.length === 0) {
      log('info', 'No drafts to sync')
      return
    }

    log('info', `Found ${drafts.length} drafts to sync`)
    let syncedCount = 0
    let failedCount = 0

    for (const draft of drafts) {
      try {
        const success = await syncSingleDraft(draft)
        if (success) {
          syncedCount++
          await markDraftAsSynced(draft.id)
        } else {
          failedCount++
        }
      } catch (error) {
        log('error', `Failed to sync draft ${draft.id}:`, error)
        failedCount++
      }
    }

    log('info', `Draft sync completed: ${syncedCount} synced, ${failedCount} failed`)

    // Уведомляем клиентов о результатах синхронизации
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SYNC_COMPLETED',
          data: { synced: syncedCount, failed: failedCount }
        })
      })
    })
  } catch (error) {
    log('error', 'Draft synchronization failed:', error)
  }
}

// Получение несинхронизированных черновиков (заглушка)
const getAllUnsyncedDrafts = async () => {
  // В реальной реализации здесь будет обращение к IndexedDB
  // или localStorage для получения черновиков с pending статусом
  return []
}

// Синхронизация отдельного черновика (заглушка)
const syncSingleDraft = async (draft) => {
  try {
    const response = await fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'mutation UpdateDraft($input: DraftInput!) { update_draft(input: $input) { draft { id } } }',
        variables: { input: draft }
      })
    })

    return response.ok
  } catch (error) {
    log('error', `Sync failed for draft ${draft.id}:`, error)
    return false
  }
}

// Отметка черновика как синхронизированного (заглушка)
const markDraftAsSynced = async (draftId) => {
  // В реальной реализации здесь будет обновление метки синхронизации
  log('info', `Marked draft ${draftId} as synced`)
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()
    log('info', 'Push notification received:', data)

    const options = {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'discours-notification',
      renotify: true,
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: 'Открыть' },
        { action: 'dismiss', title: 'Отклонить' }
      ]
    }

    event.waitUntil(self.registration.showNotification(data.title || 'Discours.io', options))
  } catch (error) {
    log('error', 'Push notification failed:', error)
  }
})

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Проверяем, есть ли уже открытый клиент
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }

      // Открываем новое окно
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})

// Обработка сообщений от клиентов
self.addEventListener('message', (event) => {
  log('info', 'Message received from client:', event.data)

  if (event.data?.type === 'GET_CACHE_STATUS') {
    // Отправляем статус кэша обратно клиенту
    getCacheStatus().then((status) => {
      event.ports[0]?.postMessage({
        type: 'CACHE_STATUS',
        data: status
      })
    })
  }

  if (event.data?.type === 'REGISTER_SYNC') {
    // Регистрируем background sync по запросу клиента
    self.registration.sync
      .register('draft-sync')
      .then(() => {
        log('info', 'Background sync registered by client request')
      })
      .catch((error) => {
        log('error', 'Failed to register background sync:', error)
      })
  }
})

// Получение статуса всех кэшей
const getCacheStatus = async () => {
  try {
    const status = {}

    for (const [name, cacheName] of Object.entries(CACHES)) {
      const cache = await caches.open(cacheName)
      const keys = await cache.keys()
      status[name] = {
        name: cacheName,
        entries: keys.length,
        urls: keys.map((request) => request.url)
      }
    }

    return status
  } catch (error) {
    log('error', 'Failed to get cache status:', error)
    return {}
  }
}
