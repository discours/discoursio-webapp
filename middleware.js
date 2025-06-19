/**
 * Middleware для Vercel для управления кешированием
 * Документация: https://vercel.com/docs/functions/edge-middleware
 */

// Статические ресурсы из public отдаем быстро с долгим кешем
const IMAGES_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff|tif|heic|heif|avif)$/i

// Middleware для обработки запросов и отладки на Vercel
export default function middleware(request) {
  const url = new URL(request.url)
  const isProduction = process.env.NODE_ENV === 'production'
  const isVercel = !!process.env.VERCEL

  // Логируем только в production на Vercel для отладки
  if (isProduction && isVercel) {
    console.log(`[Middleware] ${request.method} ${url.pathname}${url.search}`, {
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      timestamp: new Date().toISOString(),
      host: request.headers.get('host')
    })
  }

  // Проверяем критичные пути
  const criticalPaths = ['/', '/api/graphql', '/api/og']
  const isCriticalPath = criticalPaths.some((path) => url.pathname.startsWith(path))

  if (isCriticalPath) {
    console.log(`[Middleware] Critical path accessed: ${url.pathname}`)

    // Дополнительная диагностика для главной страницы
    if (url.pathname === '/' && isVercel) {
      console.log('[Middleware] Root path request details:', {
        method: request.method,
        userAgent: request.headers.get('user-agent'),
        url: request.url
      })
    }
  }

  if (IMAGES_EXTENSIONS.test(url.pathname)) {
    console.log(`[Middleware] Static image request: ${url.pathname}`)
    return null // Пропускаем статические изображения
  }

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: не возвращаем Response для обычных запросов!
  // Middleware должен возвращать null чтобы запрос продолжился к приложению
  console.log(`[Middleware] Passing through to app: ${url.pathname}`)

  return null // Позволяем запросу продолжиться к SolidStart приложению
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
