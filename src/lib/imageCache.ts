import { cdnUrl } from '~/config'

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
 * Генерирует URL изображения через квотер-прокси
 * @param src - исходный URL изображения
 * @param options - параметры для формирования URL
 * @returns URL изображения через квотер
 */
export const getCachedImageUrl = (
  src: string,
  options: { width?: number; height?: number; noSizeUrlPart?: boolean } = {}
): string => {
  if (!src) return ''

  // ВАЖНО: Статические ресурсы из public возвращаем как есть!
  if (isPublicStaticResource(src)) {
    return src
  }

  // Для локальных ресурсов возвращаем как есть
  if (!src.startsWith('http')) {
    return src
  }

  // Если noSizeUrlPart = true, возвращаем оригинальный URL без изменений
  if (options.noSizeUrlPart) {
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

    // Убираем устаревшие префиксы путей
    if (imagePath.startsWith('unsafe/production/')) {
      imagePath = imagePath.slice('unsafe/production/'.length)
    } else if (imagePath.startsWith('production/')) {
      imagePath = imagePath.slice('production/'.length)
    } else if (imagePath.startsWith('unsafe/')) {
      imagePath = imagePath.slice('unsafe/'.length)
    }
  } catch (error) {
    console.error(`[imageCache] Error parsing URL: ${error}`, src)
    return src
  }

  // Обрабатываем параметры размера - quoter поддерживает добавление размера к имени файла
  if (options.width || options.height) {
    const parts = imagePath.split('.')
    const extension = parts.pop() || ''
    let filepath = parts.join('.')

    // Добавляем размер к имени файла (quoter поддерживает filename_640x480.jpg)
    if (options.width && options.height) {
      filepath = `${filepath}_${options.width}x${options.height}`
    } else if (options.width) {
      filepath = `${filepath}_${options.width}`
    } else if (options.height) {
      filepath = `${filepath}_x${options.height}`
    }

    imagePath = `${filepath}.${extension}`
  }

  // Формируем URL через квотер-прокси
  // Quoter НЕ меняет расширение файла и НЕ обрабатывает параметры версии
  const finalUrl = `${cdnUrl}/${imagePath}`

  return finalUrl
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

// Устаревшая функция для обратной совместимости
export const getFileUrl = getCachedImageUrl
