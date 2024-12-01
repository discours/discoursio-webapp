# Система просмотров

## Текущая реализация

### Основные компоненты
- `seen` - Сигнал с записями о просмотренных материалах
- `addSeen` - Метод для добавления просмотра
- `getViewedStatus` - Метод для получения статусов просмотров от GA4

### Процесс учета просмотра
1. При монтировании страницы:
   ```typescript
   // Получаем статусы для всех статей на странице
   const slugs = articles.map(a => a.slug)
   const statuses = await getViewedStatus(slugs)
   setSeen(prev => ({...prev, ...statuses}))
   ```

2. При просмотре материала:
   ```typescript
   const addSeen = async (slug: string) => {
     // Отправляем событие в GA4
     gtag('event', 'view_item', {
       client_id: await getGAClientId(),
       item_id: slug,
       timestamp: Date.now()
     })
   }
   ```

## Требуемая реализация

### Основные компоненты
- `seen` - Сигнал с записями о просмотренных материалах
- `getViewedStatus` - Метод для получения статусов просмотров от GA4
- `updateVisibleStatuses` - Метод для обновления статусов видимых материалов

### Процесс учета просмотров
1. При монтировании страницы:
   ```typescript
   // Получаем статусы для всех статей на странице
   const slugs = articles.map(a => a.slug)
   const statuses = await getViewedStatus(slugs)
   setSeen(prev => ({...prev, ...statuses}))
   ```

2. При скролле:
   ```typescript
   // Обновляем статусы для видимых статей
   const handleScroll = async () => {
     const visibleSlugs = getVisibleArticleSlugs()
     const statuses = await getViewedStatus(visibleSlugs)
     setSeen(prev => ({...prev, ...statuses}))
   }
   ```

3. Периодическое обновление:
   ```typescript
   // Каждые 5 минут обновляем все статусы
   const updateAllStatuses = async () => {
     const allSlugs = getAllArticleSlugs()
     const statuses = await getViewedStatus(allSlugs)
     setSeen(prev => ({...prev, ...statuses}))
   }
   ```

### Взаимодействие с GA4
```typescript
const getViewedStatus = async (slugs: string[]) => {
  const clientId = await getGAClientId()
  
  // Запрашиваем события view_item для указанных slugs
  const response = await analyticsDataClient.runReport({
    property: 'properties/XXXX',
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'itemId' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: 'clientId',
              stringFilter: { value: clientId }
            }
          },
          {
            filter: {
              fieldName: 'itemId',
              inListFilter: { values: slugs }
            }
          }
        ]
      }
    }
  })

  return Object.fromEntries(
    response.rows.map(row => [row.dimensionValues[0], true])
  )
}
```

### Оптимизации
1. Кэширование:
   - TTL 5 минут для кэша статусов
   - Обновление только при скролле в область видимости
   - Батчинг запросов для похожих slugs

2. Обработка ошибок:
   - Fallback на кэшированные значения при ошибках GA4
   - Повторные попытки с exponential backoff
   - Мониторинг процента успешных запросов

### Метрики качества
- % успешных запросов к GA4 API
- Среднее время ответа API
- Cache hit rate
- Размер батчей запросов
