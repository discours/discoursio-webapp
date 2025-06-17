import { getCachedImageUrl } from './imageCache'

/**
 * Получает URL файла через квотер-прокси с поддержкой параметров
 * @deprecated Используйте getCachedImageUrl из imageCache.ts для новых реализаций
 *
 * @param src - URL изображения
 * @param options.width - Ширина изображения (поддерживается квотером)
 * @param options.height - Высота изображения (игнорируется, квотер поддерживает только width)
 * @param options.noSizeUrlPart - Если true, возвращает оригинальный размер без изменений
 */
export const getFileUrl = (
  src: string,
  options: { width?: number; height?: number; noSizeUrlPart?: boolean } = {}
): string => {
  if (!src) return ''

  // noSizeUrlPart означает возвращать оригинальный размер без изменений
  if (options.noSizeUrlPart) {
    return getCachedImageUrl(src, {}) // Без параметров размера
  }

  // Для обратной совместимости используем новую функцию кеширования
  // ПРИМЕЧАНИЕ: height игнорируется, так как квотер поддерживает только width
  return getCachedImageUrl(src, {
    width: options.width
  })
}

export const patchBodyUrls = (body: string) => {
  return body.replace(/\/images.discours.io\//g, '/files.dscrs.site/')
}
