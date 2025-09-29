import { cdnUrl } from '~/config'

// Функция для преобразования URL для CDN
export const getCdnUrl = (url: string, width?: number): string => {
  if (!url) return url
  let filepath = ''
  try {
    filepath = new URL(url).pathname
  } catch {
    filepath = url
  }
  const fileparts = filepath.split('/')
  let filename = fileparts.pop() || ''
  if (!filename) filename = filepath
  if (filename.toLowerCase() === 'webp') filename = fileparts.pop() || ''
  if (!filename) return url
  if (width) {
    const extension = filename.split('.').pop() || ''
    if (extension && !filename.includes(`_${width}`)) {
      filename = filename.replace(`.${extension}`, `_${width}.${extension}`)
    }
  }
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
