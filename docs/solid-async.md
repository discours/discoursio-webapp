# Асинхронные наблюдатели в SolidJS

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
const [feedState, setFeedState] = createStore<FeedStore>({
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
const getTopicFollowers = async () => {
  const topicFollowersFetcher = getFollowersByTopic(props.topicSlug)
  const topicFollowers = await topicFollowersFetcher()
  // sorting by maximum shouts
  if (topicFollowers) {
    return topicFollowers.sort((a, b) => (b.stat?.shouts || 0) - (a.stat?.shouts || 0))
  }
  return []
}

const [topicFollowers, { refetch: refetchFollowers }] = createResource(
  () => props.topicSlug,
  getTopicFollowers
)
```

### 3. Обработка авторизации [LoginForm.tsx](../src/components/AuthModal/LoginForm.tsx)

```typescript
// ❌ Было - смешивание состояний и асинхронной логики
const [loading, setLoading] = createSignal(false)
const [error, setError] = createSignal<string>()

const handleSubmit = async (e: Event) => {
  e.preventDefault()
  setLoading(true)
  try {
    await login(email(), password())
  } catch (e) {
    setError((e as Error).message)
  } finally {
    setLoading(false)
  }
}

// ✅ Стало - единое состояние через Store
const [authState, setAuthState] = createStore({
  loading: false,
  error: null as string | null,
  data: null as any
})

const handleSubmit = async (e: Event) => {
  e.preventDefault()
  setAuthState('loading', true)
  try {
    const data = await login(email(), password())
    setAuthState({
      data,
      loading: false,
      error: null
    })
  } catch (e) {
    setAuthState({
      error: (e as Error).message,
      loading: false
    })
  }
}
```

## Рекомендации по работе с асинхронным кодом

### 1. Используйте Store для состояния

```typescript
// В FeedProvider.tsx
const [feedState, setFeedState] = createStore<FeedStore>({
  shouts: [],
  isLoading: false,
  hasMore: false,
  error: undefined
})
```

### 2. Используйте createResource для загрузки данных

```typescript
// В TopicView.tsx
const [topicData] = createResource(
  () => props.topicSlug,
  async (slug) => {
    const response = await loadTopic(slug)
    return response.data
  }
)
```

### 3. Атомарные обновления состояния

```typescript
// В FeedProvider.tsx
setFeedState((prev) => ({
  ...prev,
  shouts: [...prev.shouts, ...newShouts],
  hasMore: newShouts.length >= FEED_PAGE_SIZE,
  loading: false
}))
```

### 4. Отображение загрузки и ошибок

```typescript
// ✅ Правильная обработка всех состояний
const [data] = createResource(loadData)
return (
  <>
    <Show when={data.loading}>
      <Loading />
    </Show>
    <Show when={data.error}>
      <ErrorMessage error={data.error} />
    </Show>
    <Show
      when={!data.loading && !data.error && data()}
      fallback={<EmptyState />}
    >
      <DataView data={data()} />
    </Show>
  </>
)```

## Важные моменты

1. **Используйте Store для:**
   - Сложных состояний с асинхронными обновлениями
   - Состояний с множественными полями
   - Состояний, требующих атомарных обновлений

2. **Используйте createResource для:**
   - Загрузки данных с сервера
   - Автоматического отслеживания зависимостей
   - Обработки состояний загрузки/ошибок

3. **Избегайте:**
   - Множества независимых сигналов для связанных данных
   - Прямых обновлений состояния в асинхронном коде
   - Смешивания бизнес-логики и управления состоянием

## Дополнительные материалы

- [SolidJS Resources](https://docs.solidjs.com/concepts/resources)
- [Understanding Solid's Stores](https://docs.solidjs.com/concepts/stores)
- [Async Patterns in SolidJS](https://docs.solidjs.com/concepts/async) 