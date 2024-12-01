# Кэширование 2.0

## Текущая реализация [graphql/api/public.ts](../src/graphql/api/public.ts)

```typescript
// Сейчас мы используем cache из @solidjs/router
export const loadTopics = () =>
  cache(async () => {
    const resp = await defaultClient.query(loadTopicsQuery, {}).toPromise()
    return resp?.data?.get_topics_all as Topic[]
  }, 'topics')

export const loadShouts = (args: QueryLoad_Shouts_ByArgs) => {
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  const filter = new URLSearchParams(options?.filters as Record<string, string>)
  
  return cache(async () => {
    const resp = await defaultClient.query(loadShoutsByQuery, args).toPromise()
    return resp?.data?.load_shouts_by as Shout[]
  }, `shouts-${filter}-${page}`)
}
```

## Почему нужно менять?

По словам Райана Карниато:
1. `cache` был временным решением
2. Не работает с SSR и гидрацией
3. Не интегрируется с новой системой ресурсов

## Новая реализация

### 1. Базовые запросы

```typescript
// Было
export const loadTopics = () =>
  cache(async () => {
    const resp = await defaultClient.query(loadTopicsQuery, {}).toPromise()
    return resp?.data?.get_topics_all
  }, 'topics')

// Стало
export const useTopics = () => {
  return createResource(async () => {
    const resp = await defaultClient.query(loadTopicsQuery, {}).toPromise()
    return resp?.data?.get_topics_all
  })
}
```

### 2. Запросы с параметрами

```typescript
// Было
export const loadShouts = (args: QueryLoad_Shouts_ByArgs) => {
  const key = `shouts-${JSON.stringify(args)}`
  return cache(async () => {
    const resp = await defaultClient.query(loadShoutsByQuery, args).toPromise()
    return resp?.data?.load_shouts_by
  }, key)
}

// Стало
export const useShouts = (args: QueryLoad_Shouts_ByArgs) => {
  return createResource(
    () => args, // Зависимость - при изменении args ресурс перезагрузится
    async (currentArgs) => {
      const resp = await defaultClient.query(loadShoutsByQuery, currentArgs).toPromise()
      return resp?.data?.load_shouts_by
    }
  )
}
```

### 3. Авторизованные запросы

```typescript
// Было
export const loadReactions = (options: QueryLoad_Reactions_ByArgs, client?: Client) => {
  const key = `reactions-${JSON.stringify(options)}`
  return cache(async () => {
    const resp = await (client || defaultClient)
      .query(loadReactionsByQuery, options)
      .toPromise()
    return resp?.data?.load_reactions_by
  }, key)
}

// Стало
export const useReactions = (options: QueryLoad_Reactions_ByArgs) => {
  const session = useSession()
  
  return createResource(
    () => [options, session.client], // Зависимости
    async ([currentOptions, client]) => {
      const resp = await (client || defaultClient)
        .query(loadReactionsByQuery, currentOptions)
        .toPromise()
      return resp?.data?.load_reactions_by
    }
  )
}
```

## Использование в компонентах

### FeedView [components/Views/FeedView.tsx](../src/components/Views/FeedView.tsx)

```typescript
// Было
const feed = loadShouts({ options })

// Стало
const [feed] = useShouts({ options })

return (
  <Show when={!feed.loading} fallback={<Loading />}>
    <For each={feed()}>{shout => 
      <ArticleCard shout={shout} />
    }</For>
  </Show>
)
```

### TopicView [components/Views/TopicView.tsx](../src/components/Views/TopicView.tsx)

```typescript
// Было
const topicData = loadTopics()

// Стало
const [topics] = useTopics()
const topicData = createMemo(() => 
  topics()?.find(t => t.slug === props.slug)
)
```

## Преимущества нового подхода

1. **Автоматическое отслеживание зависимостей**
   - Ресурс перезагружается при изменении параметров
   - Нет необходимости в ручной инвалидации кэша
   - Прозрачная интеграция с реактивностью

2. **Лучшая типизация**
   - TypeScript понимает типы данных
   - Автодополнение в IDE
   - Проверка ошибок при компиляции

3. **Готовность к SSR**
   - Работает с SolidStart из коробки
   - Поддержка streaming SSR
   - Корректная гидрация

## План миграции

1. **Этап 1: Базовые запросы**
   - Заменить простые cache на createResource
   - Обновить компоненты для работы с ресурсами
   - Проверить работу загрузки и ошибок

2. **Этап 2: Параметризованные запросы**
   - Добавить отслеживание зависимостей
   - Обновить логику пагинации
   - Проверить обновление при смене параметров

3. **Этап 3: Авторизованные запросы**
   - Интегрировать с системой сессий
   - Добавить обработку токенов
   - Проверить работу с разными клиентами

## Дополнительные материалы

- [SolidJS Resources](https://docs.solidjs.com/concepts/resources)
- [Resource Composition](https://docs.solidjs.com/concepts/resource-composition)
- [SolidStart Data](https://start.solidjs.com/concepts/data) 