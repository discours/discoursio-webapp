# Service Worker с интегрированным SSE-клиентом

## 🚀 Обзор

Service Worker (`public/sw.js`) состоит из двух основных компонентов:

### 🔧 Service Worker Core
- **Кэширование ресурсов** - статические файлы, GraphQL запросы, страницы
- **Background Sync** - автоматическая синхронизация черновиков при восстановлении связи
- **Offline-функциональность** - элегантная offline страница и обработка отсутствия сети
- **Storage Management** - управление localStorage с мониторингом квоты
- **Push-уведомления** - обработка уведомлений от сервера

### 📡 Встроенный SSE-клиент
- **Real-time соединение** - подключение к SSE серверу для получения событий
- **Автоматическое переподключение** - с экспоненциальной задержкой при обрывах
- **Трансляция событий** - пересылка SSE событий всем активным клиентам
- **Управление токенами** - автоматическая аутентификация при получении токена

## 📋 Функциональность

### ✅ Service Worker Core
- **Многоуровневое кэширование** - статические ресурсы, страницы, изображения, GraphQL
- **Background Sync** - автоматическая синхронизация черновиков при восстановлении связи
- **GraphQL кэширование** - селективное кэширование публичных запросов с TTL 30 минут
- **Storage quota monitoring** - мониторинг использования localStorage с предупреждениями
- **Performance metrics** - отслеживание скорости сохранения/загрузки данных
- **Периодическая очистка** - автоматическое удаление старых черновиков (30+ дней)
- **Sync status tracking** - детальное отслеживание статуса синхронизации каждого черновика
- **Offline-режим** - элегантная offline страница с функциональностью повторного подключения
- **Push-уведомления** - поддержка уведомлений от сервера с действиями
- **Compression** - сжатие HTML контента в localStorage для экономии места

### ✅ Встроенный SSE-клиент
- **Постоянное соединение** - подключение к `https://connect.discours.io` для real-time событий
- **Автоматическое переподключение** - до 5 попыток с экспоненциальной задержкой (1s → 30s)
- **Обработка токенов** - автоматическое подключение при получении JWT токена от клиента
- **Трансляция событий** - пересылка всех SSE событий активным клиентам через `postMessage`
- **Обработка ошибок** - graceful degradation при проблемах с сетью или сервером
- **Мониторинг состояния** - отслеживание статуса соединения и уведомление клиентов

### 🎨 Offline страница
- **Дизайн**: В стиле проекта с шрифтом Muller и корпоративными цветами
- **Артворк**: Использует `/error.svg` для визуального оформления
- **Адаптивность**: Responsive дизайн с поддержкой темной темы
- **Функциональность**: 
  - Проверка соединения с GraphQL endpoint
  - Автоматическое обнаружение восстановления сети
  - Accessibility поддержка (ARIA, клавиатура)
  - Анимации и визуальная обратная связь

### 💾 Улучшенное offline хранение
- **Storage quota checking** - проверка квоты localStorage (предупреждение при 80%+)
- **Compression** - автоматическое сжатие HTML полей body/lead
- **Performance tracking** - метрики среднего времени сохранения/загрузки
- **Metadata management** - централизованное управление метаданными хранилища
- **Sync failure tracking** - подсчёт неудачных попыток синхронизации

## 🎯 **OfflineStatus компонент**

### Возможности
- **Real-time мониторинг** - отображение актуального статуса сети и синхронизации
- **Storage statistics** - детальная статистика использования хранилища
- **Performance metrics** - отображение метрик производительности
- **Manual cleanup** - кнопка для принудительной очистки старых черновиков
- **Expandable interface** - компактный режим с возможностью раскрытия деталей

### Интеграция
```tsx
import { OfflineStatus } from '~/components/_shared/OfflineStatus'

// В EditView
<OfflineStatus 
  draftId={currentDraft()?.id}
  compact={false}
  className={styles.offlineStatus}
/>
```

## 🏗️ **Архитектура кэширования**

### 1. **Cache First** - статические ресурсы
- **Применяется к**: CSS, JS, шрифты, изображения, иконки
- **TTL**: 7 дней
- **Логика**: Кэш → Сеть (обновление в фоне)

### 2. **Network First** - динамические страницы
- **Применяется к**: HTML страницы, API endpoints
- **TTL**: 1-3 дня
- **Логика**: Сеть → Кэш (fallback)

### 3. **GraphQL Smart Caching**
- **Кэшируемые операции**: `get_topics`, `get_authors`, `load_shouts` и др.
- **Некэшируемые**: Мутации, пользовательский контент
- **TTL**: 30 минут
- **Логика**: Cache first для публичных данных, network only для приватных

### 4. **Локализация** (`stale-while-revalidate`)
- **Применяется к**: `/ru/translation.json`, `/en/translation.json`
- **TTL**: 7 дней
- **Логика**: Быстрая локализация + фоновое обновление

## 🔄 **Background Sync**

### Регистрация
```javascript
// Автоматическая регистрация при установке SW
await self.registration.sync.register('draft-sync')

// Регистрация по запросу клиента
navigator.serviceWorker.controller.postMessage({
  type: 'REGISTER_SYNC'
})
```

### Процесс синхронизации
1. **Обнаружение** несинхронизированных черновиков в localStorage
2. **Пакетная отправка** на GraphQL endpoint
3. **Обновление статуса** синхронизации для каждого черновика
4. **Уведомление клиентов** о результатах

### События
```javascript
// Слушание результатов sync в клиенте
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data.type === 'SYNC_COMPLETED') {
    console.log(`Synced: ${event.data.data.synced}, Failed: ${event.data.data.failed}`)
  }
})
```

## 📊 **Storage Management**

### Автоматическая очистка
- **Интервал**: Каждые 24 часа
- **Критерии**: Черновики старше 30 дней без активности
- **Триггеры**: При сохранении (10% вероятность), при заполнении квоты

### Сжатие данных
```javascript
// Автоматическое сжатие HTML полей
const compressText = (text) => {
  return text
    .replace(/>\s+</g, '><')  // Убираем пробелы между тегами
    .replace(/\s{2,}/g, ' ')  // Множественные пробелы в один
    .trim()
}
```

### Performance метрики
- **Average save time** - среднее время сохранения в localStorage
- **Average load time** - среднее время загрузки из localStorage  
- **Total operations** - общее количество операций
- **Storage usage** - текущее использование квоты

## 🔧 Конфигурация

### Кэшируемые GraphQL операции
```javascript
const CACHEABLE_GRAPHQL_OPERATIONS = [
  'get_topics_by_community',
  'get_topics', 
  'get_authors',
  'get_author',
  'load_authors_by',
  'get_shouts',
  'get_shout',
  'load_shouts_by',
  'get_topic_followers',
  'get_topic_authors',
  'load_topic_authors',
  'load_topic_followers',
  'load_shouts_search'
]
```

### TTL (Time To Live)
- **Статические ресурсы**: 7 дней
- **Динамический контент**: 3 дня  
- **Страницы**: 1 день
- **GraphQL запросы**: 30 минут

### Storage limits
- **Storage quota warning**: 80% от лимита localStorage
- **Max draft age**: 30 дней без активности
- **Cleanup interval**: Каждые 24 часа
- **Compression threshold**: 1KB для HTML полей

### Предварительное кэширование
```javascript
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/offline.css',
  '/favicon.ico',
  '/error.svg'
]
```

## 📊 Мониторинг и отладка

### Получение статуса кэша
```javascript
// Отправка сообщения Service Worker
navigator.serviceWorker.controller.postMessage({
  type: 'GET_CACHE_STATUS'
})

// Обработка ответа
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_STATUS') {
    console.log('Cache status:', event.data.data)
    // { static: {...}, dynamic: {...}, pages: {...}, graphql: {...} }
  }
})
```

### Storage статистика
```javascript
import { getStorageStats } from '~/components/SimpleRichEditor/lib/storage'

const stats = getStorageStats()
// {
//   quota: { used: 1024, total: 5242880, percentage: 0.0002, warning: false },
//   metadata: { lastCleanup: 1642771200000, totalDrafts: 5, ... },
//   draftsCount: 5,
//   syncPending: 2,
//   syncFailed: 0
// }
```

### Логирование
Service Worker логирует все операции с префиксом `[SW]` и временными метками:
- **INFO**: Успешные операции кэширования и синхронизации
- **WARN**: Неудачные запросы, fallback операции  
- **ERROR**: Критические ошибки

## 🔄 Lifecycle События

### Install
- Предварительное кэширование критических ресурсов
- Регистрация background sync для черновиков
- Пропуск ожидания (`skipWaiting`)

### Activate  
- Очистка устаревших версий кэша
- Удаление просроченных записей из всех кэшей
- Немедленное управление клиентами (`clients.claim`)

### Fetch
- Определение стратегии по URL и типу запроса
- Применение соответствующей логики кэширования
- Fallback на offline страницу для навигации
- Structured error responses для GraphQL

## 🔔 Push уведомления

### Обработка push событий
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json()
  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico', 
    tag: 'discours-notification',
    renotify: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'dismiss', title: 'Отклонить' }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Discours.io', options)
  )
})
```

### Обработка кликов
```javascript
self.addEventListener('notificationclick', (event) => {
  if (event.action === 'dismiss') return
  
  const url = event.notification.data?.url || '/'
  
  // Фокус на существующей вкладке или открытие новой
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
```

## 🚧 TODO

### Высокий приоритет
- [ ] **IndexedDB migration** - переход с localStorage на IndexedDB для больших объёмов
- [ ] **Real compression** - внедрение LZ-string или brotli для эффективного сжатия
- [ ] **Conflict resolution** - умная обработка конфликтов при синхронизации

### Средний приоритет  
- [ ] **Incremental sync** - синхронизация только изменённых полей
- [ ] **Offline queue** - очередь действий для выполнения при восстановлении связи
- [ ] **Cache warmup** - предварительный прогрев кэша популярным контентом

### Низкий приоритет
- [ ] **Service Worker updates** - seamless обновление SW без перезагрузки
- [ ] **Advanced caching strategies** - более сложные стратегии для разных типов контента
- [ ] **Analytics integration** - интеграция с системой аналитики

## 📚 Ресурсы

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Sync_API)
- [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Workbox](https://developer.chrome.com/docs/workbox/) - для будущих улучшений 

## 📡 **SSE-клиент (интегрированный)**

### Архитектура
SSE-клиент работает внутри Service Worker и обеспечивает real-time соединение с сервером событий.

### Конфигурация
```javascript
const SSE_CONFIG = {
  url: 'https://connect.discours.io',
  reconnectDelay: 1000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000
}
```

### Жизненный цикл соединения
1. **Инициализация** - Service Worker получает токен от клиента через `SET_TOKEN`
2. **Подключение** - SSE-клиент устанавливает соединение с заголовком `Authorization: Bearer ${token}`
3. **Обработка событий** - все SSE события транслируются клиентам через `postMessage`
4. **Переподключение** - при обрыве автоматически переподключается с экспоненциальной задержкой

### События SSE-клиента
```javascript
// Service Worker отправляет клиентам
{
  type: 'SSE_CONNECTED',
  timestamp: Date.now()
}

{
  type: 'SSE_MESSAGE', 
  data: { /* SSE event data */ },
  timestamp: Date.now()
}

{
  type: 'SSE_ERROR',
  error: 'Описание ошибки',
  timestamp: Date.now()
}
```

### Обработка в клиенте
```javascript
// Отправка токена SSE-клиенту
navigator.serviceWorker.controller.postMessage({
  type: 'SET_TOKEN',
  data: { token: 'jwt_token_here' }
})

// Получение SSE событий
navigator.serviceWorker.addEventListener('message', (event) => {
  switch (event.data.type) {
    case 'SSE_CONNECTED':
      console.log('SSE-клиент подключен')
      break
    case 'SSE_MESSAGE':
      console.log('SSE событие:', event.data.data)
      break
    case 'SSE_ERROR':
      console.error('SSE ошибка:', event.data.error)
      break
  }
})
```

### Логирование SSE-клиента
- `[SW] SSE-клиент: подключаемся к https://connect.discours.io`
- `[SW] SSE-клиент: соединение установлено`
- `[SW] SSE-клиент: получено сообщение: {data}`
- `[SW] SSE-клиент: переподключение через 2000ms (попытка 2)`
- `[SW] SSE-клиент: достигнут лимит попыток переподключения`

## 🔄 **Background Sync (Service Worker)** 