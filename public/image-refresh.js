/**
 * Скрипт для принудительного обновления изображений на странице
 * Добавляет параметр времени к URL изображений для обхода кеша
 *
 * Интегрируется с middleware.js и vercel.json для комплексной стратегии кеширования
 */
;(() => {
  // Конфигурация
  const CONFIG = {
    // Домены CDN для обновления
    cdnDomains: ['files.dscrs.site', 'images.discours.io', 'assets.discours.io', 'cdn.discours.io'],
    // Интервал периодического обновления (в мс)
    refreshInterval: 60000, // 1 минута
    // Задержка перед первым обновлением после загрузки страницы
    initialDelay: 800,
    // Максимальное количество попыток загрузки изображения
    maxRetries: 3,
    // Задержка между попытками (в мс)
    retryDelay: 500,
    // Включить отладку
    debug: true,
    // API для очистки кеша
    cacheApi: '/api/purge-cache'
  }

  // Функция логирования с возможностью отключения
  function log(level, ...args) {
    if (CONFIG.debug || level === 'error') {
      console[level]('[ImageRefresh]', ...args)
    }
  }

  // Функция для проверки, нужно ли обновлять изображение
  function shouldRefreshImage(img) {
    // Проверяем, есть ли у изображения src
    if (!img.src) return false

    // Проверяем, относится ли изображение к нашим CDN
    const isCDNImage = CONFIG.cdnDomains.some((domain) => img.src.includes(domain))
    if (!isCDNImage) return false

    // Проверяем, не является ли изображение заглушкой или иконкой
    if (img.width < 10 || img.height < 10) return false

    // Проверяем, не добавили ли мы уже параметр обновления
    const hasRefreshParam =
      img.src.includes('force_refresh=') || img.src.includes('_k=') || img.src.includes('v=')

    // Обновляем только если еще не добавлен параметр обновления
    return !hasRefreshParam
  }

  // Функция для генерации уникального идентификатора обновления
  function generateRefreshParam() {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000000)
    return `force_refresh=${timestamp}-${random}`
  }

  // Функция для добавления параметра обновления к URL
  function addRefreshParam(url, param) {
    return url.includes('?') ? `${url}&${param}` : `${url}?${param}`
  }

  // Функция для обработки ошибок загрузки изображения
  function handleImageError(img, retryCount = 0) {
    if (retryCount >= CONFIG.maxRetries) {
      log('error', `Не удалось загрузить изображение после ${retryCount} попыток:`, img.src)
      return
    }

    log('warn', `Ошибка загрузки изображения (попытка ${retryCount + 1}):`, img.src)

    // Удаляем старые параметры обновления
    let cleanUrl = img.src
    ;['force_refresh=', 'retry=', '_k=', 'v='].forEach((param) => {
      const paramIndex = cleanUrl.indexOf(param)
      if (paramIndex > -1) {
        const ampIndex = cleanUrl.indexOf('&', paramIndex)
        if (ampIndex > -1) {
          cleanUrl = cleanUrl.substring(0, paramIndex - 1) + cleanUrl.substring(ampIndex)
        } else {
          cleanUrl = cleanUrl.substring(0, paramIndex - 1)
        }
      }
    })

    // Генерируем новый параметр обновления
    const retryParam = `retry=${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
    const newSrc = addRefreshParam(cleanUrl, retryParam)

    // Устанавливаем новый src с задержкой
    setTimeout(
      () => {
        img.src = newSrc
      },
      CONFIG.retryDelay * (retryCount + 1)
    )

    // Обновляем обработчик ошибок для следующей попытки
    img.onerror = () => handleImageError(img, retryCount + 1)
  }

  // Функция для обновления изображения
  function refreshImage(img) {
    // Сохраняем оригинальный src
    const originalSrc = img.src

    // Генерируем параметр обновления
    const refreshParam = generateRefreshParam()

    // Создаем новый URL
    const newSrc = addRefreshParam(originalSrc, refreshParam)

    // Добавляем обработчики событий
    img.onerror = () => handleImageError(img)

    // Устанавливаем новый src
    img.src = newSrc

    // Для предзагрузки также обновляем ссылки на изображения
    const preloadLinks = document.querySelectorAll(`link[rel="preload"][href="${originalSrc}"]`)
    preloadLinks.forEach((link) => {
      link.href = newSrc
    })

    return newSrc
  }

  // Функция для обновления всех изображений на странице
  function refreshAllImages() {
    log('info', 'Принудительное обновление изображений...')

    // Находим все изображения на странице
    const images = document.querySelectorAll('img')
    let refreshedCount = 0

    images.forEach((img) => {
      if (shouldRefreshImage(img)) {
        refreshImage(img)
        refreshedCount++
      }
    })

    if (refreshedCount > 0) {
      log('info', `Обновлено ${refreshedCount} изображений`)
    }

    return refreshedCount
  }

  // Функция для очистки кеша браузера для изображений
  function clearImageCache() {
    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          if (cacheName.includes('image') || cacheName.includes('static')) {
            caches.delete(cacheName).then(() => {
              log('info', `Кеш ${cacheName} очищен`)
            })
          }
        })
      })
    }

    // Отправляем сообщение в Service Worker для очистки кеша изображений
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_IMAGES_CACHE'
      })
    }
  }

  // Функция для очистки кеша Vercel CDN
  async function clearVercelCache() {
    try {
      log('info', 'Запрос на очистку кеша Vercel CDN...')

      const response = await fetch(CONFIG.cacheApi, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        }
      })

      if (response.ok) {
        const data = await response.json()
        log('info', 'Кеш Vercel CDN успешно очищен:', data)
        return data
      } else {
        log('error', 'Ошибка очистки кеша Vercel CDN:', response.status)
        return null
      }
    } catch (error) {
      log('error', 'Ошибка при запросе очистки кеша:', error)
      return null
    }
  }

  // Функция для полной очистки кеша (браузер + CDN)
  async function clearAllCache() {
    // Очищаем локальный кеш браузера
    clearImageCache()

    // Очищаем кеш Vercel CDN
    await clearVercelCache()

    // Обновляем изображения на странице
    setTimeout(refreshAllImages, CONFIG.initialDelay)

    return true
  }

  // Функция инициализации
  function init() {
    log('info', 'Инициализация скрипта обновления изображений')

    // Очищаем кеш для изображений
    clearImageCache()

    // Запускаем обновление после загрузки DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(refreshAllImages, CONFIG.initialDelay)
      })
    } else {
      setTimeout(refreshAllImages, CONFIG.initialDelay)
    }

    // Обновляем изображения после полной загрузки страницы
    window.addEventListener('load', () => {
      setTimeout(refreshAllImages, CONFIG.initialDelay * 2)
    })

    // Настраиваем периодическое обновление
    setInterval(refreshAllImages, CONFIG.refreshInterval)

    // Обновляем изображения при переходе между страницами
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        setTimeout(refreshAllImages, CONFIG.initialDelay)
      }
    })

    // Добавляем обработчик для обновления изображений при навигации (SPA)
    const pushState = history.pushState
    history.pushState = (...args) => {
      pushState.apply(history, args)
      setTimeout(refreshAllImages, CONFIG.initialDelay)
    }

    // Экспортируем API для ручного обновления
    window.ImageRefresh = {
      refreshAll: refreshAllImages,
      refreshImage: refreshImage,
      clearCache: clearImageCache,
      clearAllCache: clearAllCache
    }

    log('info', 'Скрипт обновления изображений инициализирован')
  }

  // Запускаем инициализацию
  init()
})()
