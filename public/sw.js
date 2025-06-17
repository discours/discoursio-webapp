/// <reference lib="webworker" />

// Версия Service Worker - изменяйте при обновлении логики
const VERSION = '1.0.4'

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
const isCdnUrl = (url) => CONFIG.cdnUrls.some((cdnUrl) => url.startsWith(cdnUrl))

// Функция логирования с возможностью отключения
function log(level, ...args) {
  if (CONFIG.debug || level === 'error') {
    console[level]('[ServiceWorker]', ...args)
  }
}

// Стратегия "кеш первая, затем сеть"
async function cacheFirstStrategy(request, cacheName) {
  try {
    // Сначала проверяем кеш
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    // Если нет в кеше, запрашиваем из сети
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      // Кешируем успешный ответ
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    log('error', `Cache first strategy failed for ${request.url}`, error)
    return new Response('Network error occurred', { status: 503 })
  }
}

// Убрана неиспользуемая функция networkFirstStrategy

// Обработчик fetch событий
self.addEventListener('fetch', (event) => {
  // Пропускаем запросы без URL
  if (!event.request.url) return

  const url = new URL(event.request.url)

  // Пропускаем запросы к API и другие не-GET запросы
  if (url.pathname.includes('/api/') || event.request.method !== 'GET') return

  // Пропускаем локальные файлы (same-origin запросы)
  if (url.origin === self.location.origin) return

  // Обработка запросов только к CDN изображениям
  if (isCdnUrl(url.href)) {
    event.respondWith(handleImageRequest(event.request))
  }
})

// Специальная обработка запросов изображений
async function handleImageRequest(request) {
  const url = new URL(request.url)

  // Проверяем наличие параметров для обхода кеша
  const hasCacheBuster = url.search.includes('v=') || url.search.includes('retry=')

  if (hasCacheBuster) {
    log('info', `Bypassing cache for versioned CDN resource: ${url.href}`)
    // Простой fetch без кеширования
    return fetch(request, { cache: 'no-store' })
  }

  // Для обычных запросов - простая стратегия "кеш, затем сеть"
  return await cacheFirstStrategy(request, CACHES.images)
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
