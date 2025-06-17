/// <reference lib="webworker" />

// Версия Service Worker - изменяйте при обновлении логики
const VERSION = '1.0.2'

// Конфигурация кеширования
const CONFIG = {
  // Имя кеша для динамических ресурсов
  cacheName: 'discoursio-dynamic-cache-v1',
  // URLs CDN для изображений
  cdnUrls: [
    'https://files.dscrs.site',
    'https://cdn.dscrs.site', 
    'https://cdn.discours.io',
    'https://images.discours.io',
    'https://assets.discours.io'
  ],
  // Расширения файлов изображений
  imageExtensions: /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff|tif|heic|heif|avif)$/i,
  // Включить отладку
  debug: true
}

// Имена кешей
const CACHES = {
  static: 'discoursio-static-cache-v1',
  dynamic: 'discoursio-dynamic-cache-v1',
  images: 'discoursio-images-cache-v1'
}

// Функция проверки CDN URL
const isCdnUrl = (url) => CONFIG.cdnUrls.some(cdnUrl => url.startsWith(cdnUrl))

// Функция логирования с возможностью отключения
function log(level, ...args) {
  if (CONFIG.debug || level === 'error') {
    console[level]('[ServiceWorker]', ...args)
  }
}

// Стратегия "сеть первая, затем кеш" с TTL
async function networkFirstStrategy(request, cacheName, ttl = 3600 * 1000) {
  const url = new URL(request.url)
  const cacheKey = new Request(url.toString(), request)

  try {
    // Пробуем получить из сети
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      // Если успешно, кешируем результат
      const clonedResponse = networkResponse.clone()
      const cache = await caches.open(cacheName)

      // Добавляем метаданные о времени кеширования
      const responseToCache = new Response(clonedResponse.body, {
        headers: new Headers(clonedResponse.headers),
        status: clonedResponse.status,
        statusText: clonedResponse.statusText
      })
      responseToCache.headers.set('sw-fetched-on', Date.now().toString())
      responseToCache.headers.set('sw-ttl', ttl.toString())

      cache.put(cacheKey, responseToCache)
      return networkResponse
    }

    // Если сеть не вернула успешный ответ, пробуем из кеша
    const cachedResponse = await caches.match(cacheKey)
    if (cachedResponse) {
      return cachedResponse
    }

    // Если нет в кеше, возвращаем ошибку сети
    return networkResponse
  } catch (error) {
    // При ошибке сети пробуем из кеша
    const cachedResponse = await caches.match(cacheKey)

    if (cachedResponse) {
      // Проверяем TTL кешированного ответа
      const fetchedOn = Number.parseInt(cachedResponse.headers.get('sw-fetched-on') || '0')
      const ttlValue = Number.parseInt(cachedResponse.headers.get('sw-ttl') || '0')

      if (fetchedOn + ttlValue > Date.now() || ttlValue === 0) {
        // Кеш еще действителен
        return cachedResponse
      }
    }

    // Если нет действительного кеша, возвращаем ошибку
    log('error', `Network error and no valid cache for ${url.href}`, error)
    return new Response('Network error occurred', { status: 503 })
  }
}

// Обработчик fetch событий
self.addEventListener('fetch', (event) => {
  // Пропускаем запросы без URL
  if (!event.request.url) return

  const url = new URL(event.request.url)

  // Пропускаем запросы к API и другие не-GET запросы
  if (url.pathname.includes('/api/') || event.request.method !== 'GET') return

  // Обработка запросов к CDN и изображениям
  if (isCdnUrl(url.href) || url.pathname.match(CONFIG.imageExtensions)) {
    event.respondWith(handleImageRequest(event.request))
  }
})

// Специальная обработка запросов изображений
async function handleImageRequest(request) {
  const url = new URL(request.url)

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
  return await networkFirstStrategy(request, CACHES.images, 60 * 1000) // 1 минута TTL
}

// Обработчик события установки Service Worker
self.addEventListener('install', (_event) => {
  log('info', `Service Worker v${VERSION} installing...`)

  // Немедленно активируем Service Worker без ожидания закрытия вкладок
  self.skipWaiting()
})

// Обработчик события активации Service Worker
self.addEventListener('activate', (event) => {
  log('info', `Service Worker v${VERSION} activated`)

  // Очистка старых кешей при активации
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Удаляем устаревшие кеши
          if (cacheName.startsWith('discoursio-') && !Object.values(CACHES).includes(cacheName)) {
            log('info', `Deleting old cache: ${cacheName}`)
            return caches.delete(cacheName)
          }
          return Promise.resolve()
        })
      )
    })
  )

  // Захватываем контроль над всеми клиентами без перезагрузки
  self.clients.claim()
})

// Обработчик сообщений от клиентов
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_IMAGES_CACHE') {
    event.waitUntil(
      caches.open(CACHES.images).then((cache) => {
        return cache.keys().then((requests) => {
          return Promise.all(
            requests.map((request) => {
              return cache.delete(request)
            })
          ).then(() => {
            log('info', 'Images cache cleared')
            // Отправляем ответ клиенту
            if (event?.source?.postMessage) {
              event.source.postMessage({
                type: 'CACHE_CLEARED',
                timestamp: Date.now()
              })
            }
          })
        })
      })
    )
  }
})
