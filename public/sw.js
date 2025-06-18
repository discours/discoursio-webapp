/// <reference lib="webworker" />

// Service Worker для Discours.io с SSE интеграцией
// Версия: 1.0.10 - Максимальная безопасность и функциональность

const VERSION = '1.0.10'
const CLIENT_NAME = 'discours-cache-v1'

// Конфигурация SSE
const SSE_CONFIG = {
  url: 'https://discours.io/api/graphql/sse',
  reconnectDelay: 1000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000
}

// Регулярное выражение для статических ресурсов
const STATIC_RESOURCE_REGEX = /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/

// Безопасное логирование
function log(level, ...args) {
  try {
    console[level]('[SW-SSE-Safe]', ...args)
  } catch (_e) {
    // Игнорируем ошибки логирования
  }
}

// Переменные состояния
let sseConnection = null
let reconnectAttempts = 0
let isOnline = true
let currentToken = null

// Безопасная обработка fetch без блокировки
async function cacheStaticResource(request) {
  try {
    // Для статических ресурсов - кешируем ответ БЕЗ блокировки
    if (request.url.match(STATIC_RESOURCE_REGEX)) {
      // НЕ используем event.respondWith - просто кешируем параллельно
      cacheStaticResource(request).catch((err) => log('warn', 'Failed to cache static resource:', err))
      return // Пропускаем запрос к сети
    }

    const cache = await caches.open(CLIENT_NAME)
    const response = await fetch(request)

    if (response.ok) {
      cache.put(request, response.clone()).catch((err) => log('warn', 'Failed to cache response:', err))
    }

    return response
  } catch (error) {
    log('warn', 'Cache operation failed:', error)
    // Возвращаем из кеша если есть
    const cache = await caches.open(CLIENT_NAME)
    return await cache.match(request)
  }
}

// Установка SSE соединения
function establishSSEConnection(token) {
  if (!token) {
    log('warn', 'No token provided for SSE connection')
    return
  }

  try {
    if (sseConnection) {
      sseConnection.close()
    }

    const url = `${SSE_CONFIG.url}?token=${encodeURIComponent(token)}`
    sseConnection = new EventSource(url, { withCredentials: true })

    sseConnection.onopen = () => {
      log('info', 'SSE connection established')
      reconnectAttempts = 0
      broadcastToClients({
        type: 'SSE_CONNECTED',
        timestamp: Date.now()
      })
    }

    sseConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        log('info', 'SSE message received:', data.entity, data.action)

        // Пересылаем сообщение всем клиентам
        broadcastToClients({
          type: 'SSE_MESSAGE',
          data: data,
          timestamp: Date.now()
        })
      } catch (error) {
        log('error', 'Failed to parse SSE message:', error)
      }
    }

    sseConnection.onerror = (error) => {
      log('error', 'SSE connection error:', error)
      handleSSEError()
    }

    sseConnection.onclose = () => {
      log('info', 'SSE connection closed')
      handleSSEError()
    }
  } catch (error) {
    log('error', 'Failed to establish SSE connection:', error)
    handleSSEError()
  }
}

// Обработка ошибок SSE с переподключением
function handleSSEError() {
  if (sseConnection) {
    sseConnection.close()
    sseConnection = null
  }

  // Exponential backoff для переподключения
  if (reconnectAttempts < SSE_CONFIG.maxReconnectAttempts && isOnline) {
    reconnectAttempts++
    const delay = Math.min(SSE_CONFIG.reconnectDelay * 2 ** (reconnectAttempts - 1), 30000)

    log('info', `Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`)

    setTimeout(() => {
      if (currentToken && isOnline) {
        establishSSEConnection(currentToken)
      }
    }, delay)
  } else {
    log('warn', 'Max reconnection attempts reached or offline')
  }
}

// Отправка сообщений всем клиентам
async function broadcastToClients(message) {
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true })

    for (const client of clients) {
      try {
        client.postMessage(message)
      } catch (error) {
        log('warn', 'Failed to send message to client:', error)
      }
    }
  } catch (error) {
    log('error', 'Failed to broadcast to clients:', error)
  }
}

// Обработка сетевых запросов (НЕ блокируем)
self.addEventListener('fetch', (event) => {
  try {
    const url = new URL(event.request.url)

    // Для статических ресурсов - кешируем ответ БЕЗ блокировки
    if (url.pathname.match(STATIC_RESOURCE_REGEX)) {
      // НЕ используем event.respondWith - просто кешируем параллельно
      cacheStaticResource(event.request).catch((err) =>
        log('warn', 'Failed to cache static resource:', err)
      )
      return // Пропускаем запрос к сети
    }

    // Для GraphQL запросов - НЕ блокируем, только логируем
    if (url.pathname.includes('/graphql')) {
      log('debug', 'GraphQL request detected:', url.pathname)
      return // Пропускаем к сети без вмешательства
    }

    // Для всех остальных запросов - пропускаем без изменений
    return
  } catch (error) {
    log('error', 'Fetch event error:', error)
    // НЕ блокируем запрос даже при ошибке
    return
  }
})

// Обработка сообщений от клиентов
self.addEventListener('message', (event) => {
  try {
    const { type, data } = event.data || {}

    switch (type) {
      case 'SET_TOKEN': {
        currentToken = data?.token
        if (currentToken) {
          log('info', 'Token received, establishing SSE connection')
          establishSSEConnection(currentToken)
        }
        break
      }

      case 'REQUEST_BACKGROUND_SYNC': {
        if (self.registration?.sync) {
          self.registration.sync
            .register(data.tag)
            .catch((err) => log('warn', 'Failed to register background sync:', err))
        }
        break
      }

      // Добавляем функции из minimal версии
      case 'PING': {
        if (event.source?.postMessage) {
          event.source.postMessage({ type: 'PONG', timestamp: Date.now() })
        }
        break
      }

      case 'GET_VERSION': {
        if (event.source?.postMessage) {
          event.source.postMessage({ type: 'VERSION', version: VERSION })
        }
        break
      }

      case 'CLEAR_CACHE': {
        caches
          .delete(CLIENT_NAME)
          .then(() => {
            log('info', 'Cache cleared by request')
            if (event.source?.postMessage) {
              event.source.postMessage({ type: 'CACHE_CLEARED', timestamp: Date.now() })
            }
          })
          .catch((error) => {
            log('error', 'Failed to clear cache:', error)
            if (event.source?.postMessage) {
              event.source.postMessage({ type: 'CACHE_CLEAR_FAILED', error: error.message })
            }
          })
        break
      }

      default: {
        log('warn', 'Unknown message type:', type)
      }
    }
  } catch (error) {
    log('error', 'Message handling error:', error)
  }
})

// Обработка фоновой синхронизации
self.addEventListener('sync', (event) => {
  try {
    log('info', 'Background sync triggered:', event.tag)

    switch (event.tag) {
      case 'draft-sync': {
        event.waitUntil(syncDrafts())
        break
      }
      case 'message-sync': {
        event.waitUntil(syncMessages())
        break
      }
      default: {
        log('warn', 'Unknown sync tag:', event.tag)
      }
    }
  } catch (error) {
    log('error', 'Sync event error:', error)
  }
})

// Синхронизация черновиков
async function syncDrafts() {
  try {
    log('info', 'Syncing drafts...')

    // Здесь можно добавить логику синхронизации черновиков
    // Например, отправка сохраненных в IndexedDB черновиков на сервер

    broadcastToClients({
      type: 'DRAFTS_SYNCED',
      timestamp: Date.now()
    })
  } catch (error) {
    log('error', 'Failed to sync drafts:', error)
  }
}

// Синхронизация сообщений
async function syncMessages() {
  try {
    log('info', 'Syncing messages...')

    // Здесь можно добавить логику синхронизации сообщений

    broadcastToClients({
      type: 'MESSAGES_SYNCED',
      timestamp: Date.now()
    })
  } catch (error) {
    log('error', 'Failed to sync messages:', error)
  }
}

// Отслеживание состояния сети
self.addEventListener('online', () => {
  isOnline = true
  log('info', 'Network is online')

  // Переподключаем SSE если есть токен
  if (currentToken && !sseConnection) {
    reconnectAttempts = 0 // Сбрасываем счетчик при восстановлении сети
    establishSSEConnection(currentToken)
  }
})

self.addEventListener('offline', () => {
  isOnline = false
  log('info', 'Network is offline')

  if (sseConnection) {
    sseConnection.close()
    sseConnection = null
  }
})

// Безопасная установка
self.addEventListener('install', (_event) => {
  try {
    log('info', `Service Worker v${VERSION} installing...`)
    self.skipWaiting() // Немедленная активация
  } catch (error) {
    log('error', 'Install error:', error)
  }
})

// Безопасная активация
self.addEventListener('activate', (event) => {
  try {
    log('info', `Service Worker v${VERSION} activated`)

    // Очищаем старые кеши
    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== CLIENT_NAME) {
                log('info', 'Deleting old cache:', cacheName)
                return caches.delete(cacheName)
              }
            })
          )
        })
        .catch((error) => {
          log('error', 'Failed to clean old caches:', error)
        })
    )

    // Берем управление всеми клиентами
    event.waitUntil(self.clients.claim())
  } catch (error) {
    log('error', 'Activation error:', error)
  }
})

// Безопасная обработка ошибок
self.addEventListener('error', (event) => {
  log('error', 'Service Worker error:', event.error)
})

self.addEventListener('unhandledrejection', (event) => {
  log('error', 'Unhandled promise rejection in SW:', event.reason)
  event.preventDefault()
})

log('info', `Service Worker v${VERSION} script loaded`)
