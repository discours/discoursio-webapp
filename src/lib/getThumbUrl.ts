import { cdnUrl } from '~/config'

export const getFileUrl = (
  src: string,
  options: { width?: number; shout?: string | number; height?: number; noSizeUrlPart?: boolean } = {}
): string => {
  if (!src) return ''
  const parts = src.split('.')
  let extension = parts.pop()
  let filepath = parts.join('.')
  if (options.width) {
    filepath = `${filepath}_${options.width}`
  }
  const basename = filepath.split('/').pop()

  // Генерируем уникальный параметр для предотвращения кеширования
  // Используем и timestamp и случайное число для гарантированной уникальности
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000000)
  const versionParam = `v=${timestamp}-${random}`

  // Всегда добавляем параметр версии для принудительного обновления
  const hasQuery = extension?.includes('?')

  if (options.shout) {
    extension = hasQuery
      ? `${extension}&s=${options.shout}&${versionParam}`
      : `${extension}?s=${options.shout}&${versionParam}`
  } else {
    extension = hasQuery ? `${extension}&${versionParam}` : `${extension}?${versionParam}`
  }

  // Формируем URL с путем к CDN
  let result = `${cdnUrl}/${basename}.${extension}`

  // Добавляем nocache параметр для CDN и прокси-серверов
  if (!result.includes('nocache')) {
    result += result.includes('?') ? '&nocache=1' : '?nocache=1'
  }

  // console.debug(`${src} -> ${result}`)
  const cdnDomain = new URL(cdnUrl).hostname
  return result
    .replace('images.discours.io', cdnDomain)
    .replace('assets.discours.io', cdnDomain)
    .replace('cdn.discours.io', cdnDomain)
}

export const patchBodyUrls = (body: string) => {
  return body.replace(/\/images.discours.io\//g, '/files.dscrs.site/')
}
