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

// Загрузчик с авторизацией
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
- Не имеют встроенного кеширования
- Требуют ручной обработки состояний loading/error

### 2. Реактивные ресурсы (Resources)
Методы с префиксом `use*` - реактивные обертки над загрузчиками:

```typescript
// Простой ресурс
export const useTopicsResource = createQueryResource<Topic[], void>(
  loadTopicsQuery,
  () => ({})
)

// Ресурс с авторизацией
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
- Кеширование результатов
- Отмена устаревших запросов
- Интеграция с SSR

## Принципы именования

1. **Загрузчики**:
- `load*` - для публичных данных
- `load*` с `signedClient` - для приватных данных
- `get*` - для единичных сущностей (legacy)

2. **Реактивные ресурсы**:
- `use*Resource` - для публичных данных
- `use*` - для приватных данных с авторизацией

## Примеры использования

### Загрузчик для SSR

```typescript
// В route.load:
export const route = { 
  load: () => loadTopics()() 
} satisfies RouteDefinition
```

### Реактивный ресурс в компоненте

```typescript
// В компоненте:
const [feed] = useFollowedShouts({
  options: {
    limit: FEED_PAGE_SIZE,
    offset: page() * FEED_PAGE_SIZE
  }
}, signedClient)

return (
  <Show when={!feed.loading} fallback={<Loading />}>
    <For each={feed()}>{shout =>
      <ArticleCard shout={shout} />
    }</For>
  </Show>
)
```

## Миграция со старого API

1. Замените прямые вызовы `query` на загрузчики:

```typescript
// Было
const resp = await client.query(loadTopicsQuery, {}).toPromise()

// Стало
const topics = await loadTopics()()
```

2. Замените `createResource` на реактивные ресурсы:

```typescript
// Было
const [data] = createResource(() => 
  client.query(query, variables).toPromise()
)

// Стало
const [data] = useTopicsResource()
``` 