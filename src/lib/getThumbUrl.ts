import { cdnDomain, cdnUrl, thumborDomain } from '~/config'

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
  if (options.shout) {
    extension = `${extension}?s=${options.shout}`
  }
  const result = `${cdnUrl}/${basename}.${extension}`
  // console.debug(`${src} -> ${result}`)
  return result
    .replace(thumborDomain, cdnDomain)
    .replace('assets.discours.io', cdnDomain)
    .replace('cdn.discours.io', cdnDomain)
}

export const patchBodyUrls = (body: string) => {
  return body.replace(/\/images.discours.io\//g, '/files.dscrs.site/')
}
