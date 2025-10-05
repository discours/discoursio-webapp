import { cdnUrl } from '~/config'

// Кеш недавно загруженных файлов (для обхода 404 после upload)
// Ключ: filename, Значение: timestamp загрузки
const recentUploads = new Map<string, number>()
const UPLOAD_GRACE_PERIOD = 30000 // 30 секунд

/**
 * Регистрирует файл как свежезагруженный
 * Используется для обхода 404 сразу после upload (пока файл синхронизируется)
 */
export const markFileAsRecentlyUploaded = (url: string) => {
  try {
    const filename = url.split('/').pop()
    if (filename) {
      recentUploads.set(filename, Date.now())
      // Автоматически удаляем из кеша через grace period
      setTimeout(() => recentUploads.delete(filename), UPLOAD_GRACE_PERIOD)
    }
  } catch (error) {
    console.warn('[imageCache] Failed to mark file as recently uploaded:', error)
  }
}

/**
 * Проверяет, был ли файл недавно загружен
 */
const isRecentlyUploaded = (filename: string): boolean => {
  const uploadTime = recentUploads.get(filename)
  if (!uploadTime) return false

  const age = Date.now() - uploadTime
  return age < UPLOAD_GRACE_PERIOD
}

/**
 * Преобразует URL изображения для CDN - извлекает только filename (UUID + extension)
 *
 * Убирает все пути и префиксы:
 * - https://cdn.discours.io/production/image/abc-123.jpg → abc-123.jpg
 * - https://files.dscrs.site/production/image/xyz.png → xyz.png
 * - /production/image/file.jpeg → file.jpeg
 *
 * @param url - URL исходного изображения
 * @param width - Желаемая ширина для ресайза (опционально)
 * @returns URL для CDN с filename: cdnUrl/filename или /api/thumb/width/filename
 */
export const getCdnUrl = (url: string, width?: number): string => {
  if (!url) return url

  // Извлекаем путь из URL (убираем домен)
  let filepath = ''
  try {
    filepath = new URL(url).pathname
  } catch {
    // Если не URL, значит это уже путь
    filepath = url
  }

  // Разбиваем на части по слешам и берём ТОЛЬКО последний сегмент (filename)
  // Это убирает все субпути типа /production/image/
  const fileparts = filepath.split('/')
  let filename = fileparts.pop() || ''
  if (!filename) filename = filepath

  // Обработка legacy /webp суффикса (некоторые старые URL имеют /webp в конце)
  if (filename.toLowerCase() === 'webp') {
    filename = fileparts.pop() || ''
  }
  if (!filename) return url

  // Проверяем, что filename валидный (UUID.extension)
  const hasExtension =
    filename.includes('.') && filename.split('.').pop()?.length && filename.split('.').pop()!.length <= 5
  if (!hasExtension) {
    console.warn(`[getCdnUrl] Invalid filename without extension: "${filename}", returning original URL`)
    return url
  }

  // Проверяем, не был ли файл недавно загружен
  // Для свежих файлов используем прямую ссылку (обход 404 во время синхронизации)
  if (isRecentlyUploaded(filename)) {
    console.log(`[getCdnUrl] Recently uploaded file, using direct CDN: ${filename}`)
    return `${cdnUrl}/${filename}`
  }

  // Применяем width трансформацию если нужно
  if (width) {
    // В production используем /api/thumb для серверного ресайза через Vercel
    // В dev используем прямой CDN URL с width параметром
    if (import.meta.env.DEV) {
      return `${cdnUrl}/${filename}`
    }
    return `/api/thumb/${width}/${filename}`
  }

  // Без ресайза - прямая ссылка на оригинал в Quoter CDN
  return `${cdnUrl}/${filename}`
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
    img.src = getCdnUrl(src)
    if (options?.width) {
      img.src = getCdnUrl(src, options.width)
    }
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

export const getImageSrcSet = (src: string, widths: number[] = [400, 800, 1200]): string => {
  // Округляем ширины до целых чисел для валидных w дескрипторов
  const validWidths = widths.map((width) => Math.round(width)).filter((width) => width > 0)
  return validWidths.map((width) => `${getCdnUrl(src, width)} ${width}w`).join(', ')
}

/**
 * Заменяет все URL картинок в HTML на правильный CDN
 * Нужно для обработки контента, рендерящегося через innerHTML
 * Заменяет старые URL (cdn.discours.io) на новый CDN (files.dscrs.site)
 * @param html - HTML строка с картинками
 * @returns HTML с обновленными URL
 */
export const replaceImageUrls = (html: string): string => {
  if (!html) return html

  // Заменяем src в img тегах
  return html.replace(/<img([^>]+)src\s*=\s*["']([^"']+)["']/gi, (match, beforeSrc, url) => {
    // Пропускаем относительные и локальные пути
    if (!url.startsWith('http')) {
      return match
    }

    // Заменяем старый CDN (cdn.discours.io) на новый (files.dscrs.site)
    if (url.includes('cdn.discours.io')) {
      const newUrl = getCdnUrl(url)
      console.log(`[replaceImageUrls] Replaced old CDN: ${url} → ${newUrl}`)
      return `<img${beforeSrc}src="${newUrl}"`
    }

    // Для всех остальных HTTP URL тоже применяем getCdnUrl (извлекает filename)
    const newUrl = getCdnUrl(url)
    if (newUrl !== url) {
      console.log(`[replaceImageUrls] Normalized URL: ${url} → ${newUrl}`)
    }
    return `<img${beforeSrc}src="${newUrl}"`
  })
}
