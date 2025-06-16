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

  // Добавляем параметр версии или shout к URL
  const hasQuery = extension?.includes('?')
  const versionParam = `v=${Date.now()}`

  if (options.shout) {
    extension = hasQuery ? `${extension}&s=${options.shout}` : `${extension}?s=${options.shout}`
  } else if (typeof window !== 'undefined') {
    // Добавляем версию только в браузере для предотвращения кеширования
    extension = hasQuery ? `${extension}&${versionParam}` : `${extension}?${versionParam}`
  }

  const result = `${cdnUrl}/${basename}.${extension}`
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
