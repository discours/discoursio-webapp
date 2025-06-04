# Кеширование в discours.io

## Архитектура

### Основные компоненты

- GraphQL кеширование через [createQueryResource](src/graphql/client.ts)
- Локальное кеширование в [TopicsProvider](src/context/topics.tsx)
- Service Worker в [sw.js](public/sw.js)
- Мемоизация в [FeedProvider](src/context/feed.tsx)

### Реализации

#### 1. GraphQL запросы
- Базовый клиент: [client.ts](src/graphql/client.ts)
- Публичные запросы: [api/public.ts](src/graphql/api/public.ts)
- Приватные запросы: [api/private.ts](src/graphql/api/private.ts)

#### 2. Кеширование данных
- Топики: [TopicsProvider](src/context/topics.tsx)
- Авторы: [AuthorsProvider](src/context/authors.tsx)
- Статьи: [FeedProvider](src/context/feed.tsx)
- Комментарии: [CommentsProvider](src/context/comments.tsx)

#### 3. Мемоизация компонентов
- Лента: [FeedView.tsx](src/components/Views/FeedView.tsx)
- Топики: [TopicsNav.tsx](src/components/HeaderNav/TopicsNav.tsx)
- Комментарии: [CommentsTree.tsx](src/components/Comments/CommentsTree.tsx)

## Стратегии кеширования

### 1. GraphQL запросы
Пример из [api/public.ts](src/graphql/api/public.ts):

```typescript
export const useTopicsResource = createQueryResource<Topic[], void>(
    loadTopicsQuery, 
    () => ({}),
    {
        // Кеширование на 24 часа
        staleTime: 24 60 60 1000
    }
)
```

### 2. Локальное хранилище
Пример из [topics.tsx](src/context/topics.tsx):

```typescript
const TOPICS_UPDATE_INTERVAL = 24 60 60 1000
const TOPICS_LAST_UPDATE_KEY = 'topics_last_update'
function shouldUpdateTopics(): boolean {
const lastUpdate = sessionStorage.getItem(TOPICS_LAST_UPDATE_KEY)
return !lastUpdate || Date.now() - Number(lastUpdate) > TOPICS_UPDATE_INTERVAL
}
```

### 3. Service Worker
Пример из [sw.js](public/sw.js):

```typescript
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
        return response || fetch(event.request)
        })
    )
})
```


### 4. Мемоизация
Пример из [FeedProvider.tsx](src/context/feed.tsx):

```typescript
self.addEventListener('fetch', (event) => {
        event.respondWith(
        caches.match(event.request).then((response) => {
        return response || fetch(event.request)
        })
    )
})
```


## Оптимизации

### 1. Предзагрузка данных
Реализация в [FeedPage.tsx](src/routes/feed/[...mode].tsx):
- Загрузка первой страницы при SSR
- Предзагрузка следующей страницы
- Кеширование результатов

### 2. Инвалидация кеша
Логика в [cache.ts](src/lib/cache.ts):
- Автоматическая при мутациях
- По времени жизни
- При изменении зависимостей

## Мониторинг

### 1. Метрики
Отслеживание в [analytics.ts](src/lib/analytics/cache.ts):
- Cache Hit/Miss ratio
- Размер кеша
- Время жизни данных

### 2. Отладка
Инструменты в [debug.ts](src/lib/debug.ts):
- Логирование операций
- Состояние кеша
- Профилирование

## Рекомендации по улучшению

[Подробнее в документации по оптимизации](docs/optimization.md)

## Связанные компоненты

- [QueryProvider](src/context/query.tsx)
- [CacheProvider](src/context/cache.tsx)
- [StorageProvider](src/context/storage.tsx)
- [ServiceWorkerProvider](src/context/sw.tsx)

## Полезные ссылки

- [SolidJS Resources](https://www.solidjs.com/docs/latest/api#createresource)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)