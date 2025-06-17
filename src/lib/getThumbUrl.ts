import { getCachedImageUrl } from './imageCache'

/**
 * Получает URL файла через квотер-прокси с поддержкой параметров
 * @deprecated Используйте getCachedImageUrl из imageCache.ts для новых реализаций
 */
export const getFileUrl = (
  src: string,
  options: { width?: number; shout?: string | number; height?: number; noSizeUrlPart?: boolean } = {}
): string => {
  if (!src) return ''

  // Для обратной совместимости используем новую функцию кеширования
  return getCachedImageUrl(src, {
    width: options.width,
    shout: options.shout
  })
}

export const patchBodyUrls = (body: string) => {
  return body.replace(/\/images.discours.io\//g, '/files.dscrs.site/')
}
