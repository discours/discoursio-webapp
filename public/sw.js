/// <reference lib="webworker" />

// ОТКЛЮЧЕННЫЙ Service Worker - НЕ ВЫПОЛНЯЕТ НИКАКИХ ДЕЙСТВИЙ
// Этот SW только отменяет свою регистрацию и ничего не делает

console.log('[SW] ОТКЛЮЧЕН - Service Worker не активен')

// Немедленно отменяем регистрацию при активации
self.addEventListener('install', () => {
  console.log('[SW] Установка - немедленно пропускаем waiting')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Активация - отменяем регистрацию')

  // Берем контроль над клиентами
  event.waitUntil(
    self.clients
      .claim()
      .then(() => {
        console.log('[SW] Контроль взят, отправляем сообщение об отключении')

        // Уведомляем всех клиентов что SW отключен
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'SW_DISABLED',
              message: 'Service Worker отключен и будет удален'
            })
          })
        })
      })
      .then(() => {
        // Отменяем собственную регистрацию
        return self.registration.unregister()
      })
      .then(() => {
        console.log('[SW] Регистрация отменена')
      })
      .catch((error) => {
        console.error('[SW] Ошибка при отмене регистрации:', error)
      })
  )
})

// НЕ обрабатываем fetch - пропускаем все запросы
// НЕ обрабатываем message - игнорируем все сообщения
// НЕ делаем кеширование
// НЕ устанавливаем SSE соединения

console.log('[SW] Service Worker полностью отключен')
