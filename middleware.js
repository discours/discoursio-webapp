/**
 * Middleware для Vercel для управления кешированием
 * Документация: https://vercel.com/docs/functions/edge-middleware
 */

const IMAGES_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff|tif|heic|heif|avif)$/i

export default function middleware(request) {
  const headers = new Headers()
  const url = new URL(request.url)

  // Проверяем, является ли запрос к CDN или изображениям
  const isCDNRequest =
    url.hostname.includes('files.dscrs.site') || url.pathname.includes('/files.dscrs.site/')
  const isImageRequest = url.pathname.match(IMAGES_EXTENSIONS)

  // Проверяем, содержит ли URL параметры для предотвращения кеширования
  const hasNoCacheParams = ['v', 'retry'].some((param) => url.searchParams.has(param))

  // Стратегия кеширования
  if (isCDNRequest || isImageRequest) {
    if (hasNoCacheParams) {
      // Для запросов с параметрами версии - отключаем кеширование
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    } else {
      // Для обычных запросов к изображениям - короткое время кеширования
      headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    }
  } else if (url.pathname.includes('/api/')) {
    // Для API запросов - отключаем кеширование
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  } else {
    // Для остальных ресурсов - стандартное кеширование
    headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  }

  return Response.next({ headers })
}

// Конфигурация для применения middleware
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
