import { cdnUrl } from '~/config'

/**
 * Преобразует URL изображения для CDN - извлекает только filename
 *
 * @param url - URL исходного изображения
 * @param width - Желаемая ширина для ресайза (опционально)
 * @returns URL для CDN с filename
 */
export const getCdnUrl = (url: string, width?: number): string => {
  if (!url) return url

  // Извлекаем путь из URL
  let filepath = ''
  try {
    filepath = new URL(url).pathname
  } catch {
    filepath = url
  }

  // Разбиваем на части по слешам
  const fileparts = filepath.split('/')
  let filename = fileparts.pop() || ''
  if (!filename) filename = filepath

  // Обработка legacy /webp суффикса
  if (filename.toLowerCase() === 'webp') filename = fileparts.pop() || ''
  if (!filename) return url

  // Проверяем, является ли filename валидным (содержит расширение)
  const hasExtension =
    filename.includes('.') && filename.split('.').pop()?.length && filename.split('.').pop()!.length <= 5
  if (!hasExtension) {
    console.warn(`[getCdnUrl] Invalid filename without extension: "${filename}", returning original URL`)
    return url
  }

  // Применяем width трансформацию если нужно
  if (width) {
    // Используем Vercel Edge thumbnail API для ресайза
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
 * @param html - HTML строка с картинками
 * @returns HTML с обновленными URL
 */
export const replaceImageUrls = (html: string): string => {
  if (!html) return html

  // Заменяем src в img тегах
  return html.replace(/<img([^>]+)src\s*=\s*["']([^"']+)["']/gi, (match, beforeSrc, url) => {
    // Если URL содержит cdn.discours.io - заменяем на новый CDN
    if (url.includes('cdn.discours.io')) {
      const newUrl = getCdnUrl(url)
      return `<img${beforeSrc}src="${newUrl}"`
    }
    // Для других URL тоже применяем getCdnUrl (для единообразия)
    if (url.startsWith('http')) {
      const newUrl = getCdnUrl(url)
      return `<img${beforeSrc}src="${newUrl}"`
    }
    return match
  })
}
