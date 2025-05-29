// @refresh reload
import { StartClient, mount } from '@solidjs/start/client'

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
