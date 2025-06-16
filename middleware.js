/**
 * Middleware для Vercel для управления кешированием
 * Документация: https://vercel.com/docs/functions/edge-middleware
 */

const IMAGES_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|tiff|tif|heic|heif|avif)$/i

export default function middleware(request) {
  // Создаем новый объект заголовков
  const headers = new Headers()
  const url = new URL(request.url)

  // Проверяем, является ли запрос к CDN или изображениям
  const isCDNRequest =
    url.hostname.includes('files.dscrs.site') || url.pathname.includes('/files.dscrs.site/')
  const isImageRequest = url.pathname.match(IMAGES_EXTENSIONS)

  // Проверяем, содержит ли URL параметры для предотвращения кеширования
  const hasNoCacheParams =
    url.search.includes('v=') ||
    url.search.includes('_k=') ||
    url.search.includes('force_refresh=') ||
    url.search.includes('nocache=')

  // Стратегия кеширования в зависимости от типа запроса
  if (isCDNRequest || isImageRequest) {
    if (hasNoCacheParams) {
      // Для запросов с параметрами версии - полностью отключаем кеширование
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
      headers.set('Pragma', 'no-cache')
      headers.set('Expires', '0')
      headers.set('Vary', '*')
      // Добавляем заголовок для предотвращения кеширования CDN
      headers.set('Surrogate-Control', 'no-store')
      // Добавляем заголовок для принудительной перезагрузки
      headers.set('Clear-Site-Data', '"cache"')
    } else {
      // Для обычных запросов к CDN и изображениям - короткое время кеширования
      // с возможностью перепроверки при каждом запросе
      headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
      headers.set('Vary', 'Accept, Accept-Encoding')
    }
  } else if (
    url.pathname === '/' ||
    url.pathname.startsWith('/feed') ||
    url.pathname.startsWith('/articles')
  ) {
    // Для основных страниц - короткое время кеширования с быстрой перепроверкой
    headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
  } else if (url.pathname.includes('/api/')) {
    // Для API запросов - отключаем кеширование
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')
  } else {
    // Для остальных ресурсов - стандартное кеширование
    headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  }

  // Добавляем заголовки для предотвращения проблем с кешированием
  headers.set('X-Content-Type-Options', 'nosniff')

  // Логирование для отладки (будет видно в логах Vercel)
  console.log(
    `[Middleware] URL: ${url.pathname}${url.search}, Cache strategy applied: ${headers.get('Cache-Control')}`
  )

  // Возвращаем ответ с заголовками
  return Response.next({
    headers
  })
}

// Конфигурация для применения middleware
export const config = {
  matcher: [
    // Применяем ко всем путям, кроме статических ресурсов
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
