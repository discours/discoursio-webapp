import { redirect } from '@solidjs/router'

/**
 * OAuth callback роут - простой редирект после обработки бэкендом
 *
 * Архитектура:
 * 1. GitHub → БЭКЕНД /oauth/github/callback
 * 2. БЭКЕНД обрабатывает code → access_token
 * 3. БЭКЕНД → редирект сюда: /oauth?success=true (+ httpOnly cookie)
 * 4. Этот роут → редирект на главную с флагом успеха
 *
 * Простота = надежность! 🚀
 */
export function GET() {
  const url = new URL(globalThis.location?.href || 'http://localhost:3000')
  const searchParams = url.searchParams

  // Обрабатываем OAuth данные прямо здесь
  const error = searchParams.get('error')
  const state = searchParams.get('state')
  const token = searchParams.get('token') // 🔑 ТОКЕН ИЗ URL
  const redirectUrl = searchParams.get('redirect_url') || '/'

  console.log('[OAuth] Processing:', { error, hasToken: !!token, redirectUrl })

  // Обработка ошибок OAuth
  if (error) {
    console.error('[OAuth] Error from backend:', error)
    // Редирект с ошибкой для показа пользователю
    const errorUrl = new URL(redirectUrl, url.origin)
    errorUrl.searchParams.set('oauth_error', error)
    return redirect(errorUrl.toString())
  }

  // Успешная авторизация - токен передан через URL
  if (!error && token) {
    // CSRF Protection: проверяем state если есть
    if (state && typeof localStorage !== 'undefined') {
      const storedState = localStorage.getItem('oauth_state')
      if (storedState !== state) {
        console.error('[OAuth] State mismatch - possible CSRF attack')
        const errorUrl = new URL(redirectUrl, url.origin)
        errorUrl.searchParams.set('oauth_error', 'csrf_detected')
        return redirect(errorUrl.toString())
      }
      // Очищаем использованный state
      localStorage.removeItem('oauth_state')
    }

    console.log('[OAuth] Success - saving token to localStorage')
    
    // 🔑 СОХРАНЯЕМ ТОКЕН В LOCALSTORAGE
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_token', token)
      console.log('[OAuth] Token saved to localStorage')
    }

    // Чистый редирект без OAuth параметров в URL
    return redirect(redirectUrl)
  }

  // Этот код никогда не выполнится, так как !error всегда true если нет ошибки
  // Оставляем для безопасности
  console.warn('[OAuth] Unexpected state - redirecting to home')
  return redirect('/')
}
