/**
 * Middleware для Vercel для управления кешированием и проксирования файлов
 * Документация: https://vercel.com/docs/functions/edge-middleware
 */

// Middleware для обработки запросов и отладки на Vercel
// works only in vercel
export default function middleware(request) {
  const url = new URL(request.url)
  const filepath = url.pathname.split('discours.io')[1]
  const filename = filepath.split('/').pop()
  const proxyUrl = new URL(`/api/proxy/${filename}`)
  return Response.redirect(proxyUrl.toString(), 302)
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
    '/((?!_next/static|_next/_vercel/image|favicon.ico).*)'
  ]
}
