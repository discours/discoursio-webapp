# Асинхронные наблюдатели в SolidJS

> Основано на статьях Ryan Carniato:
> - [Understanding SolidJS Resource](https://dev.to/ryansolid/understanding-solidjs-resource-42h)
> - [SolidJS Async Patterns](https://dev.to/modderme123/solidjs-async-patterns-4f3n)
> - [SolidJS State Management Guide](https://www.solidjs.com/guides/state-management)
> - [SolidJS SSR Guide](https://start.solidjs.com/core-concepts/ssr)
> - [Resource Cancellation Discussion](https://github.com/solidjs/solid/issues/1252)
> - [createAsync Deprecation](https://github.com/solidjs/solid/discussions/1908)

## createResource vs createAsync

### createResource

```typescript
// ✅ Рекомендуемый подход
const [data, { refetch }] = createResource(source, fetcher)

// Доступные состояния
data.loading // boolean
data.error   // Error | undefined
data()       // T | undefined
```

Преимущества:
- Встроенная обработка состояний loading/error
- Автоматическое отслеживание зависимостей
- Возможность перезагрузки через refetch
- Кэширование результатов
- Отмена устаревших запросов

### createAsync 

```typescript
// ⚠️ Устаревший подход (будет удален в SolidJS 2.0)
// См: https://github.com/solidjs/solid/discussions/1908
const data = createAsync(async () => {
  const response = await fetch(url)
  return response.json()
})
```

Недостатки:
- Нет встроенной обработки ошибок
- Нет контроля над состоянием загрузки
- Возможны race conditions
- Нет возможности перезагрузки
- Будет удален в SolidJS 2.0

## Примеры из нашей кодовой базы

### 1. Загрузка фида [FeedProvider.tsx](../src/context/feed.tsx)

```typescript
// ❌ Было - проблемы с состоянием при асинхронной загрузке
const [feed, setFeed] = createSignal<Shout[]>([])
const [loading, setLoading] = createSignal(false)

createEffect(async () => {
  setLoading(true)
  try {
    const result = await loadShouts(options())()
    setFeed(result || [])
  } finally {
    setLoading(false)
  }
})

// ✅ Стало - атомарные обновления через Store
const [feedState, setFeedState] = createStore<FeedState>({
  shouts: [],
  isLoading: false,
  hasMore: false,
  error: undefined
})

const loadFeed = async (name: FeedMode, opts?: Partial<LoadShoutsOptions>) => {
  if (feedState.isLoading) return

  setFeedState('isLoading', true)
  try {
    const result = await loadShouts({
      options: {
        ...options(),
        ...opts,
        order_by: orderByMode(name)
      }
    })()

    setFeedState({
      shouts: opts?.offset ? [...feedState.shouts, ...(result || [])] : result || [],
      isLoading: false,
      hasMore: (result || []).length >= FEED_PAGE_SIZE
    })
  } catch (error) {
    setFeedState({
      error: error as Error,
      isLoading: false
    })
  }
}
```

### 2. Загрузка топиков [TopicView.tsx](../src/components/Views/TopicView.tsx)

```typescript
// ❌ Было - множество независимых состояний
const [topicFollowers, setTopicFollowers] = createSignal<Author[]>([])
const [loading, setLoading] = createSignal(true)
const [error, setError] = createSignal<Error>()

createEffect(async () => {
  setLoading(true)
  try {
    const followers = await getFollowersByTopic(props.topicSlug)()
    setTopicFollowers(followers || [])
  } catch (e) {
    setError(e as Error)
  } finally {
    setLoading(false)
  }
})

// ✅ Стало - использование createResource
const [topicFollowers, { refetch }] = createResource(
  () => props.topicSlug,
  async (slug) => {
    const followers = await getFollowersByTopic(slug)()
    return followers?.sort((a, b) => (b.stat?.shouts || 0) - (a.stat?.shouts || 0)) || []
  }
)
```

## Рекомендации

1. **Всегда используйте createResource вместо createAsync**
   ```typescript
   const [data] = createResource(fetchData)
   ```

2. **Используйте source для отслеживания зависимостей**
   ```typescript
   const [data] = createResource(() => [id(), filter()], fetchData)
   ```

3. **Обрабатывайте все состояния**
   ```typescript
   <Show when={!data.loading} fallback={<Loading />}>
     <Show when={!data.error} fallback={<Error error={data.error} />}>
       <DataView data={data()} />
     </Show>
   </Show>
   ```

4. **Используйте опции для оптимизации**
   ```typescript
   createResource(source, fetcher, {
     storage: sessionStorage,  // Кеширование
     ssrLoadFrom: 'initial',  // SSR оптимизации
     initialValue: [],        // Начальное значение
     name: 'uniqueName'       // Для отладки
   })
   ```

## Дополнительные материалы

- [SolidJS Resource Documentation](https://www.solidjs.com/docs/latest/api#createresource)
- [Ryan Carniato's Blog](https://dev.to/ryansolid)
- [SolidJS Discord Community](https://discord.com/invite/solidjs)

### Архивы обсуждений

- [Discord Logs](https://discord.com/channels/722131463138705510/722131463138705513)
- [GitHub Discussions](https://github.com/solidjs/solid/discussions)
- [Ryan's Dev.to Blog](https://dev.to/ryansolid)
- [Ryan's YouTube Streams](https://www.youtube.com/@ryansolid/streams)

## Работа с SSR данными

### 1. Использование route.load и createResource

```typescript
// В route.tsx
export const route = {
  load: async () => {
    const data = await fetchInitialData()
    return data
  }
} satisfies RouteDefinition

// В компоненте
export default function Page(props: RouteSectionProps<typeof route>) {
  // ✅ Правильно: используем SSR данные как initialValue
  const [data] = createResource(
    async () => {
      if (props.data) {
        return props.data // Используем SSR данные если есть
      }
      return await fetchData() // Иначе загружаем
    },
    { initialValue: props.data } // Важно для гидрации
  )
}
```

### 2. Работа с контекстом и SSR

```typescript
// В FeedProvider
const [feedState, setFeedState] = createStore<FeedState>({
  shouts: initialData?.shouts || [], // SSR данные
  isLoading: false,
  hasMore: false
})

// В компоненте
const [shouts] = createResource(
  async () => {
    if (props.data.shouts) {
      setFeedState('shouts', props.data.shouts)
      return props.data.shouts
    }
    return await loadShouts()
  },
  { initialValue: props.data.shouts }
)
```

### 3. Оптимизация гидрации

```typescript
// ✅ Правильно: используем ssrLoadFrom
const [data] = createResource(fetchData, {
  ssrLoadFrom: 'initial', // Использовать initialValue при SSR
  initialValue: props.data
})

// ❌ Неправильно: повторная загрузка при гидрации
const [data] = createResource(async () => {
  return await fetchData() // Всегда делает запрос
})
```

### 4. Пример из нашего кода [(main).tsx]

```typescript
export const route = {
  load: async () => {
    const data = {
      ...(await fetchHomeTopData()),
      featuredShouts: await featuredLoader()
    }
    return data
  }
} satisfies RouteDefinition

export default function HomePage(props: RouteSectionProps<HomeViewProps>) {
  const { setFeaturedFeed } = useFeaturedFeed()

  // Используем SSR данные
  const [shouts] = createResource(async () => {
    if (props.data.featuredShouts) {
      setFeaturedFeed(props.data.featuredShouts)
      return props.data.featuredShouts
    }
    return await loadMoreFeatured()
  }, {
    initialValue: props.data.featuredShouts
  })

  return (
    <HomeView
      featuredShouts={featuredFeed() || shouts()}
      // ...
    />
  )
}
```

### Важные моменты при работе с SSR:

1. **Используйте route.load для начальных данных**
   - Данные доступны сразу при SSR
   - Нет мерцания при гидрации
   - Меньше клиентских запросов

2. **Правильно настраивайте createResource**
   - Используйте initialValue
   - Установите ssrLoadFrom
   - Проверяйте наличие SSR данных

3. **Избегайте повторных запросов**
   - Не делайте запросы если есть SSR данные
   - Используйте условную загрузку
   - Кэшируйте данные где возможно

4. **Синхронизируйте состояние**
   - Обновляйте store/context при наличии SSR данных
   - Используйте единый источник правды
   - Следите за консистентностью данных
  
## Преимущества перехода с createAsync на createResource

### 1. Автоматическое отслеживание зависимостей
+ > См: [Understanding Solid's Reactivity](https://www.solidjs.com/guides/reactivity)
+ > Пример из нашего кода: [TopicView.tsx](../src/components/Views/TopicView.tsx)

```typescript
// ❌ Было в нашем коде - множество зависимостей
const [topicFollowers, setTopicFollowers] = createSignal<Author[]>([])
const [loading, setLoading] = createSignal(true)
createEffect(async () => {
  setLoading(true)
  const followers = await getFollowersByTopic(props.topicSlug)()
  setTopicFollowers(followers || [])
  setLoading(false)
})

// ✅ Стало - единый source и автоматическое отслеживание
const [topicFollowers] = createResource(
  () => props.topicSlug, // Единственная зависимость
  getFollowersByTopic
)
```

### 2. Готовность к SSR
+ > См: [SolidStart SSR Guide](https://start.solidjs.com/core-concepts/ssr)
+ > Пример из нашего кода: [(main).tsx](../src/routes/(main).tsx)

```typescript
// ❌ Было - проблемы с гидрацией в (main).tsx
const shouts = createAsync(async () => {
  const result = await loadMoreFeatured()
  setFeaturedFeed(result)
  return result
})

// ✅ Стало - правильная работа с SSR данными
const [shouts] = createResource(async () => {
  if (props.data.featuredShouts) {
    setFeaturedFeed(props.data.featuredShouts)
    return props.data.featuredShouts
  }
  return await loadMoreFeatured()
}, {
  initialValue: props.data.featuredShouts
})
```

### 3. Улучшенная обработка состояний
+ > См: [Resource States](https://www.solidjs.com/docs/latest/api#createresource)
+ > Пример из нашего кода: [FeedProvider.tsx](../src/context/feed.tsx)

```typescript
// ❌ Было в FeedProvider - множество сигналов состояния
const [loading, setLoading] = createSignal(true)
const [error, setError] = createSignal<Error>()
const [feed, setFeed] = createSignal<Shout[]>([])

// ✅ Стало - единое управление состоянием
const [feed] = createResource(loadFeed)
<Show when={!feed.loading} fallback={<Loading />}>
  <Show when={!feed.error} fallback={<Error error={feed.error} />}>
    <Feed data={feed()} />
  </Show>
</Show>
```

### 4. Предотвращение race conditions
+ > См: [Resource Cancellation](https://github.com/solidjs/solid/issues/1252)
+ > Пример из нашего кода: [TopicsNav.tsx](../src/components/HeaderNav/TopicsNav.tsx)

```typescript
// ❌ Было - возможные race conditions при загрузке топиков
createEffect(async () => {
  const topics = await loadTopics()
  setTopics(topics) // Может прийти в неправильном порядке
})

// ✅ Стало - автоматическая отмена устаревших запросов
const [topics] = createResource(loadTopics)
```
### 5. Возможность перезагрузки
+ > См: [Resource Refetching](https://www.solidjs.com/docs/latest/api#createresource)
+ > Пример из нашего кода: [FeedProvider.tsx](../src/context/feed.tsx)

```typescript
// ❌ Было - сложное обновление данных
const reloadFeed = () => {
  setFeed([])
  loadFeed()
}

// ✅ Стало - простое обновление
const [feed, { refetch }] = createResource(loadFeed)
<button onClick={refetch}>Обновить</button>
```

### Итоги миграции:

1. **Улучшение производительности**
+ > См: [SolidJS Performance](https://www.solidjs.com/guides/comparison)
   - Меньше ререндеров благодаря автоматическому отслеживанию
   - Оптимизированная гидрация через ssrLoadFrom
   - Встроенное кеширование вместо ручного IndexedDB

2. **Улучшение DX**
+ > См: [Why SolidJS](https://www.solidjs.com/guides/why-solid)
   - Меньше кода для управления состоянием
   - Встроенная типизация для loading/error состояний
   - Единообразный паттерн загрузки данных

3. **Улучшение UX**
+ > См: [Resource Loading States](https://www.solidjs.com/docs/latest/api#loading-states)
   - Предсказуемые состояния загрузки
   - Автоматическая отмена устаревших запросов
   - Консистентное поведение при SSR

4. **Готовность к будущим обновлениям**
+ > См: [createAsync Deprecation](https://github.com/solidjs/solid/discussions/1908)
   - createAsync удаляется в пользу createResource
   - Лучшая поддержка SSR из коробки
   - Следование рекомендуемым паттернам SolidJS
  