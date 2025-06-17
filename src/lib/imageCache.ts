import { cdnUrl } from '~/config'

// Умная версия кеша - обновляется только при деплоях
const CACHE_VERSION =
  import.meta.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || import.meta.env.npm_package_version || '1.0.0'

/**
 * Генерирует URL изображения с параметрами кеширования для квотера-прокси
 * @param src - исходный URL изображения
 * @param options - параметры для формирования URL
 * @returns URL изображения с учетом CDN и параметров
 */
export const getCachedImageUrl = (
  src: string,
  options: { width?: number; shout?: string | number } = {}
): string => {
  if (!src) return ''

  // Для локальных ресурсов возвращаем как есть
  if (!src.startsWith('http')) {
    return src
  }

  // Генерируем базовый URL через квотер-прокси
  const parts = src.split('.')
  let filepath = parts.join('.')

  if (options.width) {
    filepath = `${filepath}_${options.width}`
  }

  // Формируем URL с путем к CDN через квотер
  const cdnPath = `${cdnUrl}/unsafe/production/${src}`

  // Добавляем параметры
  const params = new URLSearchParams()
  params.set('v', CACHE_VERSION) // Фиксированная версия кеша

  if (options.shout) {
    params.set('s', String(options.shout))
  }

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
