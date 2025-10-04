import { cdnUrl } from '~/config'

// Функция для преобразования URL для CDN
export const getCdnUrl = (url: string, width?: number): string => {
  if (!url) return url

  // Извлекаем путь из URL
  let filepath = ''
  try {
    const urlObj = new URL(url)
    filepath = urlObj.pathname
  } catch {
    // Если не URL, то это уже путь
    filepath = url
  }

  // Убираем начальный слеш если есть
  filepath = filepath.replace(/^\/+/, '')

  // Разбиваем на части по слешам для обработки
  const fileparts = filepath.split('/')
  let filename = fileparts[fileparts.length - 1] || ''

  // Обработка legacy /webp суффикса
  if (filename.toLowerCase() === 'webp') {
    fileparts.pop() // убираем 'webp'
    filename = fileparts[fileparts.length - 1] || ''
  }

  if (!filename) return url

  // Проверяем, является ли filename валидным (содержит расширение)
  // Если нет расширения (например, просто число "454794"), возвращаем оригинальный URL
  const hasExtension =
    filename.includes('.') && filename.split('.').pop()?.length && filename.split('.').pop()!.length <= 5
  if (!hasExtension) {
    console.warn(`[getCdnUrl] Invalid filename without extension: "${filename}", returning original URL`)
    return url
  }

  // Применяем width трансформацию если нужно
  if (width) {
    const extension = filename.split('.').pop() || ''
    if (extension && !filename.includes(`_${width}`)) {
      filename = filename.replace(`.${extension}`, `_${width}.${extension}`)
    }
  }

  // Возвращаем полный путь с CDN доменом (сохраняем структуру директорий если она есть)
  // Если путь содержит 'production/', сохраняем его, иначе используем только filename
  if (filepath.includes('production/')) {
    // Заменяем только filename в конце пути
    const pathParts = filepath.split('/')
    pathParts[pathParts.length - 1] = filename
    return `${cdnUrl}/${pathParts.join('/')}`
  }

  // Для простых путей возвращаем только filename
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
