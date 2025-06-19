/**
 * Middleware для Vercel для управления кешированием
 * Документация: https://vercel.com/docs/functions/edge-middleware
 */

const IMAGES_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff|tif|heic|heif|avif)$/i

// Middleware для обработки запросов и отладки на Vercel
export default function middleware(request) {
  const url = new URL(request.url)
  const isProduction = process.env.NODE_ENV === 'production'
  const isVercel = !!process.env.VERCEL

  // Логируем только в production на Vercel для отладки
  if (isProduction && isVercel) {
    console.log(`[Middleware] ${request.method} ${url.pathname}`, {
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      timestamp: new Date().toISOString()
    })
  }

  // Добавляем заголовки безопасности и отладки
  const response = new Response(null, {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Debug-Timestamp': Date.now().toString(),
      'X-Environment': isProduction ? 'production' : 'development',
      'X-Platform': isVercel ? 'vercel' : 'other'
    }
  })

  // Проверяем критичные пути
  const criticalPaths = ['/', '/api/graphql', '/api/og']
  if (criticalPaths.some((path) => url.pathname.startsWith(path))) {
    console.log(`[Middleware] Critical path accessed: ${url.pathname}`)
  }

  // Статические ресурсы из public отдаем быстро с долгим кешем
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/')
  ) {
    return new Response(null, {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable' // 1 год для статических ресурсов
      }
    })
  }

  // Обрабатываем только внешние изображения
  if (url.pathname.match(IMAGES_EXTENSIONS) && url.hostname !== 'localhost') {
    // Простые заголовки кеширования - квотер сам управляет кешем
    const headers =
      url.searchParams.has('v') || url.searchParams.has('retry')
        ? { 'Cache-Control': 'no-cache' }
        : { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' }

    return new Response(null, { headers })
  }

  return response
}

// Конфигурация для применения middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - files starting with dot (hidden files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'
  ]
}
