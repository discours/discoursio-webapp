import { isAbsolute, relative, resolve, sep } from 'node:path'

export function resolvePublicFile(publicDir, requestUrl = '/') {
  let pathname

  try {
    pathname = decodeURIComponent(requestUrl.split(/[?#]/, 1)[0]).replaceAll('\\', '/')
  } catch {
    return null
  }

  if (pathname.includes('\0') || pathname.split('/').includes('..')) return null

  const requestedPath = pathname.replace(/^[/\\]+/, '') || 'index.html'
  const publicRoot = resolve(publicDir)
  const candidate = resolve(publicRoot, requestedPath)
  const relativePath = relative(publicRoot, candidate)

  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    return null
  }

  return candidate
}
