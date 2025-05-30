# Паттерны GraphQL API

## Терминология

### 1. Загрузчики (Loaders)
Методы с префиксом `load*` - прямые загрузчики данных:

```typescript
// Простой загрузчик
export const loadTopics = () => {
  return async () => {
    const resp = await defaultClient.query(loadTopicsQuery, {}).toPromise()
    return resp?.data?.get_topics_all as Topic[]
  }
}

// Кешируемый загрузчик для публичных данных
export const loadTopics = () => {
  return createCacheableLoader<Topic[], void>(
    loadTopicsQuery,
    () => ({} as QueryGet_TopicArgs),
    true // Включаем браузерное кеширование
  )(undefined)
}

// Загрузчик с авторизацией (без кеширования)
export const loadFollowedShouts = (
  { options }: QueryLoad_Shouts_FeedArgs,
  signedClient: Client | undefined
) => {
  return async () => {
    if (!signedClient) return undefined
    const resp = await signedClient.query(loadShoutsFeedQuery, { ...options }).toPromise()
    return resp?.data?.load_shouts_feed as Shout[]
  }
}
```

Особенности:
- Возвращают функцию для отложенного выполнения
- Используются для SSR и начальной загрузки
- Кешируемые версии используют браузерное кеширование для статичных данных
- Требуют ручной обработки состояний loading/error

### 2. Реактивные ресурсы (Resources)
Методы с префиксом `use*` - реактивные обертки над загрузчиками:

```typescript
// Простой ресурс
export const useTopicsResource = () => {
  return createCacheableQueryResource<Topic[], void>(
    loadTopicsQuery,
    () => ({}),
    true, // Включаем браузерное кеширование
    defaultClient,
    true // withAbort
  )(undefined)
}

// Ресурс с авторизацией (без кеширования)
export const useFollowedShouts = (
  { options }: QueryLoad_Shouts_FeedArgs,
  signedClient: Client | undefined
) => {
  return createResource(
    () => [options, signedClient] as ResourceArgs<LoadShoutsOptions>,
    async ([opts, client]) => {
      if (!client) return undefined
      const resp = await client.query(loadShoutsFeedQuery, { options: opts }).toPromise()
      return resp?.data?.load_shouts_feed as Shout[]
    }
  )
}
```

Особенности:
- Автоматическое отслеживание зависимостей
- Встроенные состояния loading/error
- Кеширование результатов (в памяти + браузерное для статичных данных)
- Отмена устаревших запросов
- Интеграция с SSR

## Принципы именования

1. **Загрузчики**:
- `load*` - для публичных данных (с кешированием где возможно)
- `load*` с `signedClient` - для приватных данных (без кеширования)
- `get*` - для единичных сущностей (legacy, теперь с кешированием)

2. **Реактивные ресурсы**:
- `use*Resource` - для публичных данных (с кешированием)
- `use*` - для приватных данных с авторизацией (без кеширования)

## Стратегии кеширования

### Что кешируется:
✅ **Статичные данные** (топики, авторы, публичные статьи)
- `loadTopics()` - 3ч браузер, 10ч CDN
- `loadAuthors()` - 30мин браузер, 1ч CDN  
- `loadShouts()` - 1мин браузер, 5мин CDN

### Что НЕ кешируется:
❌ **Динамические данные** (комментарии, реакции, персональные ленты)
- `loadReactions()` - всегда свежие данные
- `loadCommentsBranch()` - часто обновляется
- Авторизованные запросы - персональные данные

### Использование кеширования:

```typescript
// ✅ Хорошо - статичные публичные данные
const topics = await loadTopics()()
const [author] = useAuthor({ slug: "author-slug" })

// ❌ Плохо - динамические/персональные данные  
const comments = await loadReactions({ by: { kinds: [ReactionKind.Comment] } })()
const feed = await loadFollowedShouts({ options }, signedClient)()
```

## API Route /graphql

Кешируемые запросы проксируются через `/graphql` для браузерного кеширования:

```typescript
// Автоматически использует /graphql в браузере
const topics = await loadTopics()()

// Fallback к прямому GraphQL при ошибках или на сервере
// Поддерживаемые операции:
// - get_topics_all, get_authors_all
// - load_authors_by, get_author  
// - load_shouts_by, get_shout
// - load_shouts_search, get_topic_authors
```

Настройки кеширования:
- **ETag** для эффективного кеширования
- **Cache-Control** с разным временем для разных типов данных
- **CORS** для кроссдоменных запросов
- Проверка на статичность запросов

## Примеры использования

### Загрузчик для SSR

```typescript
// В route.load:
export const route = {
  load: async () => {
    const topics = await loadTopics()() // Кешируется в браузере
    return { topics }
  }
}
```

### Реактивный ресурс в компоненте

```typescript
// В компоненте:
const [topics] = useTopicsResource() // Автоматическое кеширование

return (
  <Show when={!topics.loading} fallback={<Loading />}>
    <For each={topics()}>{topic =>
      <TopicBadge topic={topic} />
    }</For>
  </Show>
)
```

### Смешанное использование

```typescript
// Статичные данные - с кешированием
const topics = await loadTopics()()
const [author] = useAuthor({ slug })

// Динамические данные - без кеширования  
const [comments] = useReactionsResource({
  by: { kinds: [ReactionKind.Comment], shout_id: shoutId }
})
```

## Миграция на кешируемые API

Для большинства случаев изменения обратно совместимы:

```typescript
// До:
const topics = await loadTopics()()

// После (автоматически):
const topics = await loadTopics()() // Теперь с браузерным кешированием
```

Специальные случаи требуют проверки логики кеширования в `isStaticQuery()` функции. 