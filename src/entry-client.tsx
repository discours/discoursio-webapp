// @refresh reload
import { StartClient, mount } from '@solidjs/start/client'

// Глобальная обработка ошибок
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler] Uncaught error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack
  })
  
  // Детальная информация для отладки
  if (event.error?.message?.includes('Cannot read properties of undefined')) {
    console.error('[Debug] Potential null reference error detected')
  }
  
  // Отправляем информацию в консоль для пользователя
  if (process.env.NODE_ENV === 'development') {
    alert(`Development Error: ${event.message}\nCheck console for details`)
  }
})

// Обработка отклоненных промисов
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Promise Rejection] Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise
  })
  
  // Предотвращаем показ ошибки в консоли браузера по умолчанию
  event.preventDefault()
  
  if (process.env.NODE_ENV === 'development') {
    console.error('[Debug] Promise rejection details:', event.reason)
  }
})

mount(() => <StartClient />, document.getElementById('app') || document.body)

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
