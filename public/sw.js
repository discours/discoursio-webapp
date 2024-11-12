/// <reference lib="webworker" />

const CACHE_VERSION = 'v1'
const _CACHE_NAME = `discours-cache-${CACHE_VERSION}`
const cdnUrl = 'https://files.dscrs.site'

// Типы кэшей
const CACHES = {
  static: 'static-v1',
  dynamic: 'dynamic-v1',
  pages: 'pages-v1'
}

// Ресурсы для предварительного кэширования
const PRECACHE_URLS = [
  '/', // Главная страница
  '/offline.html',
  '/error.svg',
  '/favicon.ico',
  '/logo.png',
  // Основные чанки приложения из бандла
  '/_build/assets/index.js',
  '/_build/assets/index.css',
  // Локализация
  '/ru/translation.json',
  '/en/translation.json'
]

// Стратегии кэширования для разных типов контента
const CACHE_STRATEGIES = {
  // Для статических ассетов - кэш с периодическим обновлением
  assets: {
    matches: (url) => url.includes('/_build/assets/'),
    strategy: 'stale-while-revalidate',
    cacheName: CACHES.static
  },
  // Для страниц - сначала сеть, затем кэш
  pages: {
    matches: (url) => {
      const path = new URL(url).pathname
      return path === '/' || !path.includes('.')
    },
    strategy: 'network-first',
    cacheName: CACHES.pages
  },
  // Для изображений - сначала кэш, затем сеть
  images: {
    matches: (url) => url.includes(cdnUrl),
    strategy: 'cache-first',
    cacheName: CACHES.dynamic
  },
  // Для API - только сеть
  api: {
    matches: (url) => url.includes('/api/'),
    strategy: 'network-only'
  }
}

// Установка сервис-воркера
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHES.static).then((cache) => cache.addAll(PRECACHE_URLS)),
      self.skipWaiting() // Активировать немедленно
    ])
  )
})

// Активация и очистка старых кэшей
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Очистка старых версий кэша
      caches
        .keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames
              .filter((name) => name.startsWith('discours-'))
              .filter((name) => !Object.values(CACHES).includes(name))
              .map((name) => caches.delete(name))
          )
        }),
      // Начать контролировать страницы сразу после активации
      self.clients.claim()
    ])
  )
})

// Обработка запросов
self.addEventListener('fetch', (event) => {
  // Пропускаем не GET запросы
  if (event.request.method !== 'GET') return

  // Определяем стратегию кэширования
  const url = new URL(event.request.url)
  const strategy = Object.values(CACHE_STRATEGIES).find((s) => s.matches(url.toString()))

  if (!strategy) {
    // По умолчанию - только сеть
    return
  }

  switch (strategy.strategy) {
    case 'stale-while-revalidate':
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((response) => {
            // Кэшируем новый ответ
            const responseClone = response.clone()
            if (strategy.cacheName) {
              caches.open(strategy.cacheName).then((cache) => {
                cache.put(event.request, responseClone)
              })
            }
            return response
          })
          return cachedResponse || fetchPromise
        })
      )
      break

    case 'network-first':
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            // Кэшируем успешный ответ
            const responseClone = response.clone()
            if (strategy.cacheName) {
              caches.open(strategy.cacheName).then((cache) => {
                cache.put(event.request, responseClone)
              })
            }
            return response
          })
          .catch(async () => {
            const response = await caches.match(event.request)
            return response || (await caches.match('/offline.html')) || new Response('Offline')
          })
      )
      break

    case 'cache-first':
      event.respondWith(
        caches.match(event.request).then((response) => {
          if (response) {
            // Возвращаем кэш и обновляем его в фоне
            fetch(event.request).then((response) => {
              caches.open(strategy.cacheName).then((cache) => {
                cache.put(event.request, response)
              })
            })
            return response
          }
          // Если нет в кэше - загружаем с сети
          return fetch(event.request).then((response) => {
            const responseClone = response.clone()
            caches.open(strategy.cacheName).then((cache) => {
              cache.put(event.request, responseClone)
            })
            return response
          })
        })
      )
      break

    case 'network-only':
      event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')))
      break

    default:
      return
  }
})

// Периодическая очистка кэша
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'clear-old-caches') {
    event.waitUntil(
      caches.open(CACHES.dynamic).then((cache) => {
        // Удаляем записи старше недели
        cache.keys().then((requests) => {
          requests.forEach((request) => {
            cache.match(request).then((response) => {
              if (
                response &&
                Date.now() - new Date(response.headers.get('date')).getTime() > 7 * 24 * 60 * 60 * 1000
              ) {
                cache.delete(request)
              }
            })
          })
        })
      })
    )
  }
})

// Синхронизация в фоне
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reactions') {
    event.waitUntil(syncReactions())
  }
})

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/favicon.ico',
    data: {
      url: data.url
    }
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})

// Функция для синхронизации реакций
async function syncReactions() {
  // TODO: Implement syncReactions
}
