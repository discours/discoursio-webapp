import { redirect } from '@solidjs/router'

/**
 * OAuth callback роут - простой редирект после обработки бэкендом
 *
 * Процесс:
 * 1. GitHub → БЭКЕНД /oauth/github/callback
 * 2. БЭКЕНД обрабатывает code → access_token
 * 3. БЭКЕНД → редирект сюда: /oauth?access_token=JWT_TOKEN&state=STATE
 * 4. Этот роут → сохраняет токен в localStorage → редирект на главную
 *
 * Простота = надежность!
 */
export function GET() {
  const url = new URL(globalThis.location?.href || 'http://localhost:3000')
  const searchParams = url.searchParams

  // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА OAuth
  console.log('🔍 [OAuth Debug] Full URL:', url.href)
  console.log('🔍 [OAuth Debug] Search params:', url.search)

  // Показываем ВСЕ параметры URL
  const allParams = Object.fromEntries(searchParams.entries())
  console.log('🔍 [OAuth Debug] All URL params:', allParams)

  // Обрабатываем OAuth данные прямо здесь
  const error = searchParams.get('error')
  const state = searchParams.get('state')
  const token = searchParams.get('access_token') // 🔑 ПРАВИЛЬНЫЙ ПАРАМЕТР ОТ БЭКЕНДА
  const redirectUrl = searchParams.get('redirect_url') || '/'

  console.log('🔍 [OAuth Debug] Extracted params:', {
    error,
    state: state ? `${state.substring(0, 10)}...` : null,
    hasToken: !!token,
    tokenPreview: token ? `${token.substring(0, 20)}...` : null,
    redirectUrl
  })

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

    console.log('✅ [OAuth Debug] Success - saving token to localStorage')

    // 🔑 СОХРАНЯЕМ ТОКЕН В LOCALSTORAGE
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth-token', token) // Используем правильный ключ

      // 🔍 ПРОВЕРЯЕМ ЧТО ТОКЕН СОХРАНИЛСЯ
      const savedToken = localStorage.getItem('auth-token')
      console.log('🔍 [OAuth Debug] Token saved successfully:', !!savedToken)
      console.log('🔍 [OAuth Debug] Saved token preview:', savedToken ? `${savedToken.substring(0, 20)}...` : 'null')

      // 🔍 ПРОВЕРЯЕМ JWT СТРУКТУРУ
      if (savedToken) {
        try {
          const parts = savedToken.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]))
            console.log('🔍 [OAuth Debug] JWT payload:', {
              user_id: payload.user_id,
              exp: payload.exp ? new Date(payload.exp * 1000) : 'no exp',
              iat: payload.iat ? new Date(payload.iat * 1000) : 'no iat'
            })
          }
        } catch (e) {
          console.error('❌ [OAuth Debug] Invalid JWT token:', e)
        }
      }
    } else {
      console.error('❌ [OAuth Debug] localStorage not available!')
    }

    // 🔄 РЕДИРЕКТ С ДИАГНОСТИКОЙ
    console.log('🔄 [OAuth Debug] Redirecting to:', redirectUrl)
    console.log('🔄 [OAuth Debug] Clearing URL params...')

    return redirect(redirectUrl)
  }

  // 🚨 НЕОЖИДАННОЕ СОСТОЯНИЕ
  console.error('❌ [OAuth Debug] Unexpected state - no token and no error!')
  console.error('❌ [OAuth Debug] This should not happen. Check backend OAuth implementation.')
  return redirect('/')
}
