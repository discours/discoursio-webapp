import { cdnUrl } from '~/config'

// Умная версия кеша - обновляется только при деплоях
const CACHE_VERSION =
  import.meta.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || import.meta.env.npm_package_version || '1.0.0'

// Проверка поддержки WebP браузером
const supportsWebP = (() => {
  if (typeof window === 'undefined') return false

  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
  } catch {
    return false
  }
})()

/**
 * Определяет оптимальный формат изображения для браузера
 * @param originalPath - исходный путь к файлу
 * @returns путь с оптимальным форматом
 */
const webpExtRegex = /\.(jpe?g|png|gif)$/i
const getOptimalFormat = (originalPath: string): string => {
  // Если браузер поддерживает WebP и это не SVG
  if (supportsWebP && !originalPath.toLowerCase().endsWith('.svg')) {
    // Заменяем расширение на .webp
    return originalPath.replace(webpExtRegex, '.webp')
  }
  return originalPath
}

/**
 * Проверяет является ли URL статическим ресурсом из public папки
 * @param src - URL для проверки
 * @returns true если это статический ресурс
 */
const isPublicStaticResource = (src: string): boolean => {
  if (!src) return false

  // Локальные файлы из public (начинаются с /)
  if (src.startsWith('/') && !src.startsWith('//')) {
    return true
  }

  // Проверяем популярные статические расширения
  const staticExtensions = [
    '.svg',
    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
    '.eot',
    '.css',
    '.js',
    '.ico',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp'
  ]
  const lowerSrc = src.toLowerCase()

  return (
    staticExtensions.some((ext) => lowerSrc.includes(ext)) &&
    (lowerSrc.includes('/icons/') || lowerSrc.includes('/fonts/') || lowerSrc.includes('/public/'))
  )
}

/**
 * Генерирует URL изображения с параметрами кеширования для квотера-прокси
 * @param src - исходный URL изображения
 * @param options - параметры для формирования URL
 * @returns URL изображения с учетом CDN и параметров
 */
export const getCachedImageUrl = (src: string, options: { width?: number } = {}): string => {
  if (!src) return ''

  // ВАЖНО: Статические ресурсы из public возвращаем как есть!
  if (isPublicStaticResource(src)) {
    return src
  }

  // Для локальных ресурсов возвращаем как есть
  if (!src.startsWith('http')) {
    return src
  }

  // Извлекаем путь из CDN URL
  let imagePath = ''

  try {
    const url = new URL(src)
    // Убираем домен, оставляем только путь
    imagePath = url.pathname

    // Если путь начинается со слеша, убираем его
    if (imagePath.startsWith('/')) {
      imagePath = imagePath.slice(1)
    }

    // Упрощаем путь - убираем дублирующийся "production/"
    if (imagePath.startsWith('production/')) {
      imagePath = imagePath.slice('production/'.length)
    }
  } catch (error) {
    console.error(`[imageCache] ${error}`, src)
    return src
  }

  // Обрабатываем параметры ширины
  if (options.width) {
    const parts = imagePath.split('.')
    const extension = parts.pop() || ''
    let filepath = parts.join('.')
    filepath = `${filepath}_${options.width}`
    imagePath = `${filepath}.${extension}`
  }

  // Применяем оптимальный формат (WebP если поддерживается)
  imagePath = getOptimalFormat(imagePath)

  // Формируем упрощенный URL через квотер-прокси
  // Теперь без "unsafe" и без дублирования "production"
  const cdnPath = `${cdnUrl}/${imagePath}`

  // Добавляем параметры запроса
  const params = new URLSearchParams()
  params.set('v', CACHE_VERSION)

  // УСТАРЕЛО: shout оверлеи больше не используются
  // if (options.shout) {
  //   params.set('s', String(options.shout))
  // }

  return `${cdnPath}?${params.toString()}`
}

/**
 * Генерирует srcSet для адаптивных изображений
 * @param src - исходный URL изображения
 * @param widths - массив ширин для генерации
 * @returns строка srcSet для адаптивных изображений
 */
export const getCachedImageSrcSet = (src: string, widths: number[] = [400, 800, 1200]): string => {
  if (!src) return ''

  return widths.map((width) => `${getCachedImageUrl(src, { width })} ${width}w`).join(', ')
}

/**
 * Предзагружает изображение для быстрого отображения
 * @param src - URL изображения
 * @param options - параметры изображения
 */
export const preloadImage = (src: string, options?: { width?: number }): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve()
      return
    }

    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Failed to preload: ${src}`))
    img.src = getCachedImageUrl(src, options)
  })
}

/**
 * Предзагружает массив изображений
 * @param urls - массив URL изображений с опциями
 */
export const preloadImages = async (urls: Array<{ src: string; width?: number }>): Promise<void> => {
  try {
    await Promise.allSettled(urls.map(({ src, width }) => preloadImage(src, { width })))
  } catch (error) {
    console.warn('[imageCache] Some images failed to preload:', error)
  }
}
