/// <reference lib="webworker" />

// Service Worker для Discours.io с интегрированным SSE-клиентом
// Версия: 1.0.12 - Тихое кеширование без избыточного логирования

const VERSION = '1.0.12'
const CLIENT_NAME = `discours-presence-client-v${VERSION}`
const SSE_URL = 'https://connect.discours.io'

// Флаг для отключения функциональности при критических ошибках
let isFunctional = true

// Конфигурация для встроенного SSE-клиента
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
      console[level]('[SW]', ...args)
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

// === SSE-КЛИЕНТ (встроенный в Service Worker) ===

// Состояние встроенного SSE-клиента
let sseConnection = null
let currentToken = null
let reconnectAttempts = 0
let isOnline = true

// Установка SSE соединения через встроенный клиент
function establishSSEConnection(token) {
  if (!isFunctional || !isOnline) {
    log('warn', 'SSE-клиент: пропускаем подключение - SW не функционален или офлайн')
    return
  }

  if (sseConnection) {
    log('info', 'SSE-клиент: закрываем существующее соединение')
    try {
      sseConnection.close()
    } catch (e) {
      log('warn', 'SSE-клиент: ошибка закрытия соединения:', e)
    }
  }

  try {
    const url = `${SSE_CONFIG.url}?token=${encodeURIComponent(token)}`
    log('info', 'SSE-клиент: подключаемся к', SSE_CONFIG.url)

    sseConnection = new EventSource(url)
    currentToken = token

    sseConnection.onopen = () => {
      log('info', 'SSE-клиент: соединение установлено')
      reconnectAttempts = 0

      // Уведомляем клиентов о подключении
      broadcastToClients({
        type: 'SSE_CONNECTED',
        timestamp: Date.now()
      }).catch((error) => log('error', 'SSE-клиент: ошибка уведомления о подключении:', error))
    }

    sseConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        log('debug', 'SSE-клиент: получено сообщение:', data)

        // Транслируем SSE сообщение всем клиентам
        broadcastToClients({
          type: 'SSE_MESSAGE',
          data: data,
          timestamp: Date.now()
        }).catch((error) => log('error', 'SSE-клиент: ошибка трансляции сообщения:', error))
      } catch (error) {
        log('error', 'SSE-клиент: ошибка парсинга сообщения:', error)
      }
    }

    sseConnection.onerror = (error) => {
      log('error', 'SSE-клиент: ошибка соединения:', error)
      handleSSEError()
    }
  } catch (error) {
    log('error', 'SSE-клиент: критическая ошибка подключения:', error)
    handleSSEError()
  }
}

// Обработка ошибок SSE-клиента
function handleSSEError() {
  if (sseConnection) {
    try {
      sseConnection.close()
    } catch (e) {
      log('warn', 'SSE-клиент: ошибка закрытия при обработке ошибки:', e)
    }
    sseConnection = null
  }

  // Переподключение с экспоненциальной задержкой
  if (reconnectAttempts < SSE_CONFIG.maxReconnectAttempts && currentToken && isOnline && isFunctional) {
    const delay = Math.min(SSE_CONFIG.reconnectDelay * 2 ** reconnectAttempts, 30000)
    reconnectAttempts++

    log('info', `SSE-клиент: переподключение через ${delay}ms (попытка ${reconnectAttempts})`)

    setTimeout(() => {
      if (currentToken && isOnline && isFunctional) {
        establishSSEConnection(currentToken)
      }
    }, delay)
  } else {
    log('error', 'SSE-клиент: достигнут лимит попыток переподключения или нет условий для подключения')

    // Уведомляем клиентов об ошибке
    broadcastToClients({
      type: 'SSE_ERROR',
      error: 'Не удалось подключиться к SSE',
      timestamp: Date.now()
    }).catch((error) => log('error', 'SSE-клиент: ошибка уведомления об ошибке:', error))
  }
}

// Безопасная обработка кеширования - ТОЛЬКО фоновое кеширование
async function cacheStaticResource(request) {
  // Максимально безопасная функция кеширования
  try {
    // Проверяем базовые условия
    if (!isFunctional || !request || !request.url) {
      return null
    }

    // Проверяем что это действительно статический ресурс
    if (!request.url.match(STATIC_RESOURCE_REGEX)) {
      return null
    }

    // Делаем независимый fetch (не блокируем оригинальный запрос)
    const response = await fetch(request)

    // Кешируем только успешные ответы
    if (response?.ok && response?.status >= 200 && response?.status < 300) {
      try {
        const cache = await caches.open(CLIENT_NAME)
        await cache.put(request, response.clone())
      } catch (_cacheError) {
        // Тихо игнорируем ошибки кеширования
      }
    }

    return response
  } catch (_error) {
    // Тихо игнорируем ВСЕ ошибки кеширования
    return null
  }
}

// === SERVICE WORKER ОСНОВНЫЕ ФУНКЦИИ ===

// Отправка сообщений всем клиентам с защитой от ошибок
async function broadcastToClients(message) {
  if (!isFunctional) {
    log('warn', 'Service Worker: трансляция пропущена - не функционален')
    return
  }

  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })

    if (!clients || clients.length === 0) {
      log('debug', 'Service Worker: нет активных клиентов для трансляции')
      return
    }

    const promises = clients.map((client) => {
      try {
        if (client && typeof client.postMessage === 'function') {
          return client.postMessage(message)
        }
      } catch (error) {
        log('warn', 'Service Worker: ошибка отправки сообщения клиенту:', error)
      }
      return Promise.resolve()
    })

    await Promise.allSettled(promises)
    log('debug', `Service Worker: сообщение отправлено ${clients.length} клиентам`)
  } catch (error) {
    log('error', 'Service Worker: критическая ошибка трансляции:', error)
  }
}

// === SERVICE WORKER ОБРАБОТЧИКИ СОБЫТИЙ ===

// Обработка fetch запросов - ПОЛНОСТЬЮ ПАССИВНЫЙ РЕЖИМ
self.addEventListener('fetch', (event) => {
  // ВАЖНО: НЕ вызываем event.respondWith() - пропускаем ВСЕ запросы к сети

  if (!checkFunctionality()) {
    return // Пропускаем всё если не функциональны
  }

  try {
    const url = new URL(event.request.url)

    // Только для статических ресурсов запускаем фоновое кеширование
    // НО НИКОГДА НЕ БЛОКИРУЕМ основной запрос
    if (url.pathname.match(STATIC_RESOURCE_REGEX)) {
      // Запускаем кеширование в фоне асинхронно
      Promise.resolve().then(async () => {
        try {
          await cacheStaticResource(event.request.clone())
        } catch (_err) {
          // Тихо игнорируем ошибки фонового кеширования
        }
      })
      // НЕ вызываем event.respondWith() - запрос идет через сеть
    }

    // Для всех остальных запросов - НИЧЕГО НЕ ДЕЛАЕМ
    // Запрос автоматически идет через сеть
  } catch (error) {
    log('error', 'Service Worker: ошибка fetch обработчика:', error)
    // КРИТИЧНО: НИКОГДА не блокируем запрос даже при ошибке
  }

  // НЕ вызываем event.respondWith() - все запросы проходят через сеть
})

// Обработка сообщений от клиентов с максимальной защитой
self.addEventListener('message', (event) => {
  if (!checkFunctionality()) {
    log('warn', 'Service Worker: обработчик сообщений пропущен - не функционален')
    return
  }

  try {
    if (!event || !event.data) {
      log('warn', 'Service Worker: получено невалидное сообщение')
      return
    }

    const { type, data } = event.data

    switch (type) {
      case 'SET_TOKEN': {
        try {
          currentToken = data?.token
          if (currentToken && typeof currentToken === 'string') {
            log('info', 'Service Worker: получен токен, запускаем SSE-клиент')
            establishSSEConnection(currentToken)
          } else {
            log('warn', 'Service Worker: получен невалидный токен')
          }
        } catch (error) {
          log('error', 'Service Worker: ошибка обработки SET_TOKEN:', error)
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
          const response = {
            type: 'PONG',
            timestamp: Date.now(),
            messageId: data?.messageId // Сохраняем ID для отслеживания
          }

          // Пытаемся отправить через event.source
          if (event.source?.postMessage) {
            event.source.postMessage(response)
          } else {
            // Fallback: отправляем всем клиентам
            log('warn', 'event.source недоступен для PING, отправляем всем клиентам')
            broadcastToClients(response).catch((error) => {
              log('error', 'Failed to broadcast PONG:', error)
            })
          }
        } catch (error) {
          log('error', 'Error handling PING:', error)
        }
        break
      }

      case 'GET_VERSION': {
        try {
          const response = {
            type: 'VERSION',
            version: VERSION,
            messageId: data?.messageId
          }

          // Пытаемся отправить через event.source
          if (event.source?.postMessage) {
            event.source.postMessage(response)
          } else {
            // Fallback: отправляем всем клиентам
            log('warn', 'event.source недоступен, отправляем версию всем клиентам')
            broadcastToClients(response).catch((error) => {
              log('error', 'Failed to broadcast version:', error)
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
