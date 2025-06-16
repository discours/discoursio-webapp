/**
 * Middleware для Vercel для управления кешированием
 * Документация: https://vercel.com/docs/functions/edge-middleware
 */

const IMAGES_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff|tif|heic|heif|avif)$/i

export default function middleware(request) {
  const url = new URL(request.url)

  // Обрабатываем только изображения
  if (url.pathname.match(IMAGES_EXTENSIONS)) {
    const response = new Response(null, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'CDN-Cache-Control': 'public, max-age=31536000'
      }
    })

    // Если есть параметры кеширования - принудительно обходим кеш
    const hasCacheParams =
      url.searchParams.has('v') || url.searchParams.has('t') || url.searchParams.has('retry')

    if (hasCacheParams) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      response.headers.set('CDN-Cache-Control', 'no-cache')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
    }

    return response
  }

  // Для остальных запросов возвращаем null (продолжаем обработку)
  return null
}

// Конфигурация для применения middleware
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
