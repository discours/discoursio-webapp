/// <reference lib="webworker" />

// Service Worker для Discours.io с SSE интеграцией
// Версия: 1.0.12 - Тихое кеширование без избыточного логирования

const VERSION = '1.0.12'
const CLIENT_NAME = `discours-presence-client-v${VERSION}`
const SSE_URL = 'https://connect.discours.io'

// Флаг для отключения функциональности при критических ошибках
let isFunctional = true

// Конфигурация SSE
const SSE_CONFIG = {
  url: SSE_URL,
  reconnectDelay: 1000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000
}

// Регулярное выражение для статических ресурсов
const STATIC_RESOURCE_REGEX = /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/

// Безопасное логирование с полным отказоустойчивостью
function log(level, ...args) {
  try {
    if (console && typeof console[level] === 'function') {
      console[level]('[SW-SSE-Safe]', ...args)
    }
  } catch (_e) {
    // Полностью игнорируем любые ошибки логирования
  }
}

// Безопасная проверка работоспособности
function checkFunctionality() {
  try {
    // Проверяем базовую функциональность
    if (typeof fetch !== 'function' || typeof caches === 'undefined') {
      isFunctional = false
      log('error', 'Critical APIs unavailable, disabling SW functionality')
      return false
    }
    return true
  } catch (error) {
    isFunctional = false
    log('error', 'Functionality check failed:', error)
    return false
  }
}

// Переменные состояния
let sseConnection = null
let reconnectAttempts = 0
let isOnline = true
let currentToken = null

// Безопасная обработка кеширования без блокировки основных запросов
async function cacheStaticResource(request) {
  if (!isFunctional) return null

  try {
    // Проверяем что это действительно статический ресурс
    if (!request || !request.url || !request.url.match(STATIC_RESOURCE_REGEX)) {
      return null
    }

    const cache = await caches.open(CLIENT_NAME)
    const response = await fetch(request.clone())

    if (response?.ok && response?.status >= 200 && response?.status < 300) {
      // Кешируем только успешные ответы, тихо игнорируем ошибки
      try {
        await cache.put(request, response.clone())
        // Убираем логирование для уменьшения шума
      } catch (_cacheError) {
        // Тихо игнорируем ошибки кеширования
      }
      return response
    }

    return response
  } catch (_error) {
    // Убираем логирование ошибок кеширования для уменьшения шума

    // Fallback на обычный fetch при ошибках кеширования
    return fetch(request)
  }
}

// Установка SSE соединения с максимальной защитой от ошибок
function establishSSEConnection(token) {
  if (!isFunctional || !token) {
    log('warn', 'SSE connection skipped - not functional or no token')
    return
  }

  try {
    // Закрываем существующее соединение
    if (sseConnection) {
      try {
        sseConnection.close()
      } catch (e) {
        log('warn', 'Error closing existing SSE connection:', e)
      }
      sseConnection = null
    }

    const url = `${SSE_CONFIG.url}?token=${encodeURIComponent(token)}`
    sseConnection = new EventSource(url, { withCredentials: true })

    sseConnection.onopen = () => {
      log('info', 'SSE connection established')
      reconnectAttempts = 0
      broadcastToClients({
        type: 'SSE_CONNECTED',
        timestamp: Date.now()
      }).catch((e) => log('warn', 'Failed to broadcast SSE_CONNECTED:', e))
    }

    sseConnection.onmessage = (event) => {
      try {
        if (!event || !event.data) return

        const data = JSON.parse(event.data)
        log('debug', 'SSE message received:', data.entity, data.action)

        // Пересылаем сообщение всем клиентам
        broadcastToClients({
          type: 'SSE_MESSAGE',
          data: data,
          timestamp: Date.now()
        }).catch((e) => log('warn', 'Failed to broadcast SSE_MESSAGE:', e))
      } catch (error) {
        log('warn', 'Failed to parse SSE message:', error)
      }
    }

    sseConnection.onerror = (error) => {
      log('warn', 'SSE connection error:', error)
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

// Обработка ошибок SSE с переподключением и защитой от бесконечных циклов
function handleSSEError() {
  try {
    if (sseConnection) {
      try {
        sseConnection.close()
      } catch (e) {
        log('warn', 'Error closing SSE connection:', e)
      }
      sseConnection = null
    }

    // Exponential backoff для переподключения с максимальными ограничениями
    if (reconnectAttempts < SSE_CONFIG.maxReconnectAttempts && isOnline && isFunctional) {
      reconnectAttempts++
      const delay = Math.min(SSE_CONFIG.reconnectDelay * 2 ** (reconnectAttempts - 1), 30000)

      log(
        'info',
        `Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${SSE_CONFIG.maxReconnectAttempts})`
      )

      setTimeout(() => {
        try {
          if (currentToken && isOnline && isFunctional) {
            establishSSEConnection(currentToken)
          }
        } catch (e) {
          log('error', 'Error during reconnection attempt:', e)
        }
      }, delay)
    } else {
      log('warn', 'Max reconnection attempts reached, offline, or not functional')
    }
  } catch (error) {
    log('error', 'Error in handleSSEError:', error)
  }
}

// Отправка сообщений всем клиентам с защитой от ошибок
async function broadcastToClients(message) {
  if (!isFunctional) return

  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true })

    if (!clients || clients.length === 0) {
      // Тихо выходим если нет клиентов
      return
    }

    const promises = clients.map(async (client) => {
      try {
        if (client && typeof client.postMessage === 'function') {
          client.postMessage(message)
        }
      } catch (error) {
        log('warn', 'Failed to send message to client:', error)
      }
    })

    await Promise.allSettled(promises)
  } catch (error) {
    log('error', 'Failed to broadcast to clients:', error)
  }
}

// Обработка сетевых запросов (НИКОГДА не блокируем)
self.addEventListener('fetch', (event) => {
  // Проверяем функциональность в самом начале
  if (!checkFunctionality()) {
    return // Пропускаем все обработки если не функциональны
  }

  try {
    // Дополнительная проверка на валидность запроса
    if (!event || !event.request || !event.request.url) {
      return
    }

    const url = new URL(event.request.url)

    // Для статических ресурсов - ТОЛЬКО кешируем параллельно, НИКОГДА не блокируем
    if (url.pathname.match(STATIC_RESOURCE_REGEX)) {
      // Запускаем кеширование в фоне, но НЕ блокируем основной запрос
      Promise.resolve().then(async () => {
        try {
          await cacheStaticResource(event.request)
        } catch (_err) {
          // Тихо игнорируем ошибки фонового кеширования
        }
      })
      return // Основной запрос идет через сеть без задержек
    }

    // Для GraphQL запросов - только логируем, НЕ вмешиваемся
    if (url.pathname.includes('/graphql')) {
      // Убираем логирование для уменьшения шума
      return // Полностью пропускаем к сети
    }

    // Для всех остальных запросов - полностью пропускаем
    return
  } catch (error) {
    log('error', 'Fetch event error:', error)
    // КРИТИЧНО: НИКОГДА не блокируем запрос даже при ошибке
    return
  }
})

// Обработка сообщений от клиентов с максимальной защитой
self.addEventListener('message', (event) => {
  if (!checkFunctionality()) {
    log('warn', 'Message handler skipped - not functional')
    return
  }

  try {
    if (!event || !event.data) {
      log('warn', 'Invalid message event received')
      return
    }

    const { type, data } = event.data

    switch (type) {
      case 'SET_TOKEN': {
        try {
          currentToken = data?.token
          if (currentToken && typeof currentToken === 'string') {
            log('info', 'Token received, establishing SSE connection')
            establishSSEConnection(currentToken)
          } else {
            log('warn', 'Invalid token received')
          }
        } catch (error) {
          log('error', 'Error handling SET_TOKEN:', error)
        }
        break
      }

      case 'REQUEST_BACKGROUND_SYNC': {
        try {
          if (self.registration?.sync && data?.tag) {
            self.registration.sync
              .register(data.tag)
              .catch((err) => log('warn', 'Failed to register background sync:', err))
          }
        } catch (error) {
          log('error', 'Error handling REQUEST_BACKGROUND_SYNC:', error)
        }
        break
      }

      case 'PING': {
        try {
          if (event.source?.postMessage) {
            event.source.postMessage({
              type: 'PONG',
              timestamp: Date.now(),
              messageId: data?.messageId // Сохраняем ID для отслеживания
            })
          }
        } catch (error) {
          log('error', 'Error handling PING:', error)
        }
        break
      }

      case 'GET_VERSION': {
        try {
          if (event.source?.postMessage) {
            event.source.postMessage({
              type: 'VERSION',
              version: VERSION,
              messageId: data?.messageId
            })
          }
        } catch (error) {
          log('error', 'Error handling GET_VERSION:', error)
        }
        break
      }

      case 'CLEAR_CACHE': {
        try {
          caches
            .delete(CLIENT_NAME)
            .then(() => {
              log('info', 'Cache cleared by request')
              if (event.source?.postMessage) {
                event.source.postMessage({
                  type: 'CACHE_CLEARED',
                  timestamp: Date.now(),
                  messageId: data?.messageId
                })
              }
            })
            .catch((error) => {
              log('error', 'Failed to clear cache:', error)
              if (event.source?.postMessage) {
                event.source.postMessage({
                  type: 'CACHE_CLEAR_FAILED',
                  error: error.message,
                  messageId: data?.messageId
                })
              }
            })
        } catch (error) {
          log('error', 'Error handling CLEAR_CACHE:', error)
        }
        break
      }

      default: {
        log('debug', 'Unknown message type:', type)
      }
    }
  } catch (error) {
    log('error', 'Message handling error:', error)
  }
})

// Обработка фоновой синхронизации с защитой от ошибок
self.addEventListener('sync', (event) => {
  if (!checkFunctionality()) {
    log('warn', 'Sync handler skipped - not functional')
    return
  }

  try {
    if (!event || !event.tag) {
      log('warn', 'Invalid sync event received')
      return
    }

    log('info', 'Background sync triggered:', event.tag)

    switch (event.tag) {
      case 'draft-sync': {
        if (event.waitUntil && typeof event.waitUntil === 'function') {
          event.waitUntil(syncDrafts())
        } else {
          syncDrafts().catch((err) => log('error', 'Sync drafts failed:', err))
        }
        break
      }
      case 'message-sync': {
        if (event.waitUntil && typeof event.waitUntil === 'function') {
          event.waitUntil(syncMessages())
        } else {
          syncMessages().catch((err) => log('error', 'Sync messages failed:', err))
        }
        break
      }
      default: {
        log('debug', 'Unknown sync tag:', event.tag)
      }
    }
  } catch (error) {
    log('error', 'Sync event error:', error)
  }
})

// Синхронизация черновиков с защитой от ошибок
async function syncDrafts() {
  if (!isFunctional) return

  try {
    log('info', 'Syncing drafts...')

    // Здесь можно добавить логику синхронизации черновиков
    // Например, отправка сохраненных в IndexedDB черновиков на сервер

    await broadcastToClients({
      type: 'DRAFTS_SYNCED',
      timestamp: Date.now()
    })

    log('info', 'Drafts sync completed')
  } catch (error) {
    log('error', 'Failed to sync drafts:', error)
  }
}

// Синхронизация сообщений с защитой от ошибок
async function syncMessages() {
  if (!isFunctional) return

  try {
    log('info', 'Syncing messages...')

    // Здесь можно добавить логику синхронизации сообщений

    await broadcastToClients({
      type: 'MESSAGES_SYNCED',
      timestamp: Date.now()
    })

    log('info', 'Messages sync completed')
  } catch (error) {
    log('error', 'Sync messages error:', error)
  }
}

// Отслеживание состояния сети с защитой от ошибок
self.addEventListener('online', () => {
  try {
    isOnline = true
    log('info', 'Network is online')

    // Переподключаем SSE если есть токен и мы функциональны
    if (currentToken && !sseConnection && isFunctional) {
      reconnectAttempts = 0 // Сбрасываем счетчик при восстановлении сети
      establishSSEConnection(currentToken)
    }
  } catch (error) {
    log('error', 'Error handling online event:', error)
  }
})

self.addEventListener('offline', () => {
  try {
    isOnline = false
    log('info', 'Network is offline')

    if (sseConnection) {
      try {
        sseConnection.close()
      } catch (e) {
        log('warn', 'Error closing SSE connection on offline:', e)
      }
      sseConnection = null
    }
  } catch (error) {
    log('error', 'Error handling offline event:', error)
  }
})

// Обработка установки Service Worker
self.addEventListener('install', (_event) => {
  try {
    log('info', 'Service Worker installing, version:', VERSION)

    // Проверяем функциональность при установке
    checkFunctionality()

    // Принудительно активируем новую версию
    if (self.skipWaiting && typeof self.skipWaiting === 'function') {
      self.skipWaiting()
    }
  } catch (error) {
    log('error', 'Error during install:', error)
  }
})

// Обработка активации Service Worker
self.addEventListener('activate', (event) => {
  try {
    log('info', 'Service Worker activating, version:', VERSION)

    // Проверяем функциональность при активации
    if (!checkFunctionality()) {
      log('error', 'Service Worker is not functional, will operate in degraded mode')
      return
    }

    // Очищаем старые кеши при активации новой версии
    const cleanupPromise = caches
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
        log('warn', 'Error cleaning up old caches:', error)
      })

    // Немедленно берем контроль над всеми клиентами
    const claimPromise = self.clients?.claim?.() || Promise.resolve()

    if (event.waitUntil && typeof event.waitUntil === 'function') {
      event.waitUntil(Promise.all([cleanupPromise, claimPromise]))
    }

    log('info', 'Service Worker activated successfully')
  } catch (error) {
    log('error', 'Error during activation:', error)
  }
})

// Обработка ошибок Service Worker
self.addEventListener('error', (event) => {
  try {
    log('error', 'Service Worker error:', event.error || event.message)

    // При критических ошибках отключаем функциональность
    isFunctional = false
  } catch (_e) {
    // Даже обработка ошибок может упасть - игнорируем
  }
})

// Обработка необработанных отклонений промисов
self.addEventListener('unhandledrejection', (event) => {
  try {
    log('error', 'Unhandled promise rejection:', event.reason)

    // Предотвращаем аварийное завершение
    if (event.preventDefault && typeof event.preventDefault === 'function') {
      event.preventDefault()
    }
  } catch (e) {
    log('error', 'Unhandled promise rejection:', e)
    // Игнорируем ошибки в обработчике ошибок
  }
})

// Инициализация при запуске
try {
  log('info', 'Service Worker script loaded, version:', VERSION)
  checkFunctionality()

  if (isFunctional) {
    log('info', 'Service Worker is functional and ready')
  } else {
    log('warn', 'Service Worker is in degraded mode')
  }
} catch (error) {
  log('error', 'Error during Service Worker initialization:', error)
  isFunctional = false
}
