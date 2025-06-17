/**
 * Middleware для Vercel для управления кешированием
 * Документация: https://vercel.com/docs/functions/edge-middleware
 */

const IMAGES_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff|tif|heic|heif|avif)$/i

export default function middleware(request) {
  const url = new URL(request.url)

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

  return null
}

// Конфигурация для применения middleware
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
