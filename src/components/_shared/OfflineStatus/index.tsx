import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { isServer } from 'solid-js/web'

export const OfflineStatus = () => {
  const [isOnline, setIsOnline] = createSignal(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Обработчики событий изменения статуса сети
  const handleOnline = () => {
    setIsOnline(true)
    console.info('[Network] Соединение восстановлено')
  }

  const handleOffline = () => {
    setIsOnline(false)
    console.warn('[Network] Соединение потеряно')
  }

  onMount(() => {
    // Проверяем, что мы не на сервере
    if (!isServer && typeof window !== 'undefined') {
      // Добавляем слушатели событий
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }
  })

  onCleanup(() => {
    // Проверяем, что мы не на сервере
    if (!isServer && typeof window !== 'undefined') {
      // Удаляем слушатели событий
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  })

  // Эффект для отображения уведомления о статусе сети
  createEffect(() => {
    if (!isOnline()) {
      // Можно добавить отображение уведомления о потере соединения
    }
  })

  // Компонент не отображает никакого UI, только управляет состоянием сети
  return null
}
