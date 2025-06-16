// Базовая версия кеша
const BASE_CACHE_VERSION = '1.0.0'

/**
 * Получает версию кеша с timestamp для обхода агрессивного кеширования
 */
const getCacheVersion = () => {
  // Проверяем, что мы не на сервере
  if (typeof window === 'undefined') {
    return BASE_CACHE_VERSION
  }
  return `${BASE_CACHE_VERSION}-${Date.now()}`
}

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

  // Для внешних URL добавляем параметры кеширования
  if (src.startsWith('http')) {
    const url = new URL(src)

    // Добавляем параметры запроса для обхода кеша
    url.searchParams.set('v', getCacheVersion())

    // Добавляем timestamp только в браузере
    if (typeof window !== 'undefined') {
      url.searchParams.set('t', Date.now().toString())
    }

    if (options.shout) {
      url.searchParams.set('s', options.shout.toString())
    }

    if (options.width) {
      url.searchParams.set('w', options.width.toString())
    }

    return url.toString()
  }

  // Для локальных ресурсов возвращаем как есть
  return src
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
