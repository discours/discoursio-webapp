# Система просмотров

## Текущая реализация

### Основные компоненты
- `ViewsProvider` - контекст для хранения просмотров
- `seen` - Set с ID просмотренных материалов
- `addSeen` - метод для добавления просмотра

### Процесс учета просмотра
1. При открытии материала:
   - Проверяется наличие в `seen`
   - Если нет - отправляется запрос на сервер
   - ID добавляется в локальный `seen`

### Ограничения
- Нет синхронизации между вкладками
- Просмотры не привязаны к сессии
- Возможен двойной учет при очистке localStorage

## Планируемые улучшения

### Интеграция с Google Analytics
- Использование User ID из сессии
- Передача события просмотра через GA4
- Учет уникальных просмотров по сессии

### Серверная валидация
- Проверка токена сессии
- Дедупликация по User ID
- Защита от накрутки просмотров

### Синхронизация
- Обмен данными между вкладками
- Периодическое обновление статуса
- Очистка устаревших записей

### Метрики
- Время просмотра
- Глубина прокрутки
- Взаимодействие с контентом

## Лучшие практики реализации

### Метрики просмотра

1. **Время просмотра**
   ```typescript
   // Отслеживаем реальное время просмотра
   const trackViewDuration = () => {
     let startTime = Date.now()
     let isVisible = true
     
     // Учитываем только когда страница видима
     document.addEventListener('visibilitychange', () => {
       if (document.hidden) {
         isVisible = false
       } else {
         isVisible = true
         startTime = Date.now() // Сбрасываем время при возврате
       }
     })

     // Отправляем метрику при уходе со страницы
     window.addEventListener('beforeunload', () => {
       if (isVisible) {
         const duration = Date.now() - startTime
         gtag('event', 'view_duration', {
           value: duration,
           page: window.location.pathname
         })
       }
     })
   }
   ```

2. **Глубина прокрутки**
   ```typescript 
   const trackScrollDepth = () => {
     let maxDepth = 0
     let contentHeight = document.body.scrollHeight
     
     window.addEventListener('scroll', () => {
       const scrolled = window.scrollY + window.innerHeight
       const depth = Math.round((scrolled / contentHeight) * 100)
       
       if (depth > maxDepth) {
         maxDepth = depth
         // Отправляем события по достижению порогов
         if (maxDepth >= 25 && maxDepth < 50) {
           gtag('event', 'scroll_milestone', { value: 25 })
         } else if (maxDepth >= 50 && maxDepth < 75) {
           gtag('event', 'scroll_milestone', { value: 50 })
         } else if (maxDepth >= 75 && maxDepth < 100) {
           gtag('event', 'scroll_milestone', { value: 75 })
         }
       }
     }, { passive: true })
   }
   ```

### Оптимизация производительности

1. **Кэширование статусов**
   ```typescript
   // Кэшируем результаты запросов к GA на 5 минут
   const cache = new Map<string, {value: boolean, timestamp: number}>()
   const CACHE_TTL = 5 * 60 * 1000 // 5 минут
   
   const getViewedStatusCached = async (slug: string) => {
     const now = Date.now()
     const cached = cache.get(slug)
     
     if (cached && (now - cached.timestamp < CACHE_TTL)) {
       return cached.value
     }
     
     const status = await getViewedStatus([slug])
     cache.set(slug, {
       value: status[slug] || false,
       timestamp: now
     })
     
     return status[slug] || false
   }
   ```

2. **Батчинг запросов**
   ```typescript
   // Группируем запросы статусов в батчи
   let batchQueue: string[] = []
   let batchTimeout: NodeJS.Timeout | null = null
   
   const queueViewedStatus = (slug: string) => {
     batchQueue.push(slug)
     
     if (!batchTimeout) {
       batchTimeout = setTimeout(async () => {
         const batch = [...batchQueue]
         batchQueue = []
         batchTimeout = null
         
         const statuses = await getViewedStatus(batch)
         for (const slug of batch) {
           cache.set(slug, {
             value: statuses[slug] || false,
             timestamp: Date.now()
           })
         }
       }, 100) // Ждем 100ms для группировки запросов
     }
   }
   ```

### Обработка ошибок

```typescript
const getViewedStatus = async (slugs: string[]) => {
  try {
    const clientId = await getGAClientId()
    const response = await analyticsDataClient.runReport({
      // ... конфиг запроса
    })
    return processResponse(response)
  } catch (error) {
    // При ошибках GA возвращаем кэшированные значения
    console.error('GA API error:', error)
    return Object.fromEntries(
      slugs.map(slug => [slug, cache.get(slug)?.value || false])
    )
  }
}
```

### Метрики качества
- Отслеживание % успешных запросов к GA API
- Время ответа API
- Размер батчей и частота запросов
- Эффективность кэширования (cache hit rate)

## Реализация через Google Analytics

### Принцип работы
1. При инициализации приложения:
   - Получаем Client ID из GA4
   - Запрашиваем статусы просмотров для текущей страницы

2. При просмотре материала:
   ```typescript
   const addSeen = async (slug: string) => {
     const clientId = await getGAClientId()
     
     // Отправляем событие в GA4
     gtag('event', 'view_item', {
       client_id: clientId,
       item_id: slug,
       content_type: 'article', // или 'author', 'topic'
       timestamp: Date.now()
     })
     
     // Обновляем локальный статус
     setSeen(prev => ({...prev, [slug]: true}))
   }
   ```

3. Получение статусов просмотров:
   ```typescript
   const getViewedStatus = async (slugs: string[]) => {
     const clientId = await getGAClientId()
     
     // Запрашиваем напрямую из GA4 Analytics Data API
     const response = await analyticsDataClient.runReport({
       property: 'properties/XXXX',
       dimensions: [{ name: 'itemId' }],
       metrics: [{ name: 'eventCount' }],
       dimensionFilter: {
         filter: {
           fieldName: 'clientId',
           stringFilter: { value: clientId }
         }
       }
     })
     
     // Обновляем локальный статус
     const viewed = new Set(response.rows.map(row => row.dimensionValues[0]))
     setSeen(prev => ({
       ...prev,
       ...Object.fromEntries(slugs.map(slug => [slug, viewed.has(slug)]))
     }))
   }
   ```

### Преимущества
- Надежная дедупликация по Client ID
- Точная статистика уникальных просмотров
- Не требует собственного бэкенда
- Автоматическая синхронизация между вкладками
