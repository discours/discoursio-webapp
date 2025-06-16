import { cdnUrl } from '~/config'

/**
 * Функция для получения URL изображения с параметрами для предотвращения кеширования
 * @param src - исходный URL изображения
 * @param options - параметры для формирования URL
 * @returns URL изображения с учетом CDN и параметров
 */
export const getCachedImageUrl = (
  src: string,
  options: { width?: number; shout?: string | number } = {}
): string => {
  if (!src) return ''

  // Генерируем базовый URL
  const parts = src.split('.')
  const extension = parts.pop() || ''
  let filepath = parts.join('.')
  if (options.width) {
    filepath = `${filepath}_${options.width}`
  }
  const basename = filepath.split('/').pop() || ''

  // Формируем URL с путем к CDN
  const cdnDomain = new URL(cdnUrl).hostname
  let result = `${cdnUrl}/${basename}.${extension}`

  // Заменяем устаревшие домены на текущий CDN домен
  result = result
    .replace('images.discours.io', cdnDomain)
    .replace('assets.discours.io', cdnDomain)
    .replace('cdn.discours.io', cdnDomain)

  // Добавляем параметры запроса
  const params = new URLSearchParams()
  params.append('v', Date.now().toString())

  if (options.shout) {
    params.append('s', options.shout.toString())
  }

  return `${result}?${params.toString()}`
}

/**
 * Функция для получения srcSet с разными плотностями пикселей
 * @param src - исходный URL изображения
 * @param width - базовая ширина изображения
 * @returns строка с набором изображений разной плотности пикселей
 */
export const getCachedImageSrcSet = (src: string, width: number): string => {
  if (!src) return ''

  return [1, 2, 3]
    .map((density) => `${getCachedImageUrl(src, { width: width * density })} ${density}x`)
    .join(', ')
}
