// @refresh reload
import { StartClient, mount } from '@solidjs/start/client'

mount(() => <StartClient />, document.getElementById('app') || document.body)

// Загружаем скрипт для принудительного обновления изображений
if (typeof window !== 'undefined') {
  // Определяем, запущено ли приложение на Vercel
  const isVercel =
    window.location.hostname.includes('discoursio-website.vercel.app') ||
    window.location.hostname.includes('discours.io') ||
    window.location.hostname.includes('dscrs.site')

  // Загружаем скрипт только на Vercel
  if (isVercel) {
    const script = document.createElement('script')
    script.src = `/image-refresh.js?v=${Date.now()}`
    script.async = true
    document.head.appendChild(script)
    console.log('[App] Загружен скрипт обновления изображений для Vercel')
  }
}

// Регистрируем SW только на клиенте и только в production
if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('SW registered:', registration.scope)
    } catch (error) {
      console.error('Error registering SW:', error)
    }
  })
}

export default {}
