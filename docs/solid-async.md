# Асинхронные наблюдатели в SolidJS

### Проблема асинхронных наблюдателей

```typescript
// ❌ Проблема: потеря реактивности в асинхронном коде
const [count, setCount] = createSignal(0)

createEffect(async () => {
  await someAsyncOperation()
  console.log(count()) // Может пропустить обновления
})
```

### Решение через Store

```typescript
// ✅ Store сохраняет реактивность в асинхронном коде
const [state, setState] = createStore({
  count: 0,
  timestamp: Date.now()
})

createEffect(async () => {
  await someAsyncOperation()
  console.log(state.count) // Надежно отслеживает изменения
})
```

## Примеры из нашего кода

### FeedProvider [context/feed.tsx](../src/context/feed.tsx)

```typescript
// Было - проблемы с асинхронным отслеживанием
const [feed, setFeed] = createSignal<Shout[]>([])
const [loading, setLoading] = createSignal(false)

createEffect(async () => {
  setLoading(true)
  await loadFeed()
  setLoading(false)
})

// Стало - надежное отслеживание через Store
const [feedState, setFeedState] = createStore({
  items: [] as Shout[],
  loading: false,
  error: null as Error | null,
  timestamp: Date.now()
})

createEffect(async () => {
  setFeedState('loading', true)
  try {
    const items = await loadFeed()
    setFeedState(store => ({
      ...store,
      items,
      loading: false,
      timestamp: Date.now()
    }))
  } catch (error) {
    setFeedState('error', error as Error)
  }
})
```

### Почему Store лучше для асинхронных операций

1. **Атомарные обновления**
```typescript
// Store гарантирует атомарность
setFeedState(store => ({
  items: [...store.items, newItem],
  timestamp: Date.now()
}))
```

2. **Предсказуемые подписки**
```typescript
// Store надежно отслеживает вложенные изменения
createEffect(() => {
  console.log('Items updated:', feedState.items.length)
  console.log('Last update:', new Date(feedState.timestamp))
})
```

3. **Производительность**
```typescript
// Store оптимизирует обновления
const visibleItems = createMemo(() => 
  feedState.items.filter(item => 
    item.timestamp > feedState.timestamp - 86400000
  )
)
```

## Когда использовать Store

### 1. Асинхронные операции
```typescript
const [authState, setAuthState] = createStore({
  user: null,
  loading: false,
  error: null
})

// Надежная работа с асинхронным кодом
async function login() {
  setAuthState('loading', true)
  try {
    const user = await api.login()
    setAuthState({ user, loading: false })
  } catch (error) {
    setAuthState({ error, loading: false })
  }
}
```

### 2. Сложные объекты с вложенными обновлениями
```typescript
const [uiState, setUIState] = createStore({
  theme: {
    mode: 'light',
    colors: {
      primary: '#007AFF'
    }
  },
  layout: {
    sidebar: true
  }
})

// Точечные обновления
setUIState('theme', 'mode', 'dark')
```

### 3. Состояния с множественными подписчиками
```typescript
const [appState, setAppState] = createStore({
  notifications: [],
  unreadCount: 0,
  lastUpdate: null as Date | null
})

// Множество наблюдателей
createEffect(() => {
  updateBadge(appState.unreadCount)
})

createEffect(() => {
  syncWithServer(appState.notifications)
})
```

## Важные моменты

1. **Используйте Store для:**
   - Асинхронных операций
   - Сложных объектов
   - Множественных подписчиков

2. **Используйте Signals для:**
   - Простых значений
   - Синхронных операций
   - Одиночных подписчиков

## Дополнительные материалы

- [Understanding Stores in SolidJS](https://www.solidjs.com/tutorial/stores_nested_reactivity)
- [Ryan's Deep Dive into Stores](https://dev.to/ryansolid/a-hands-on-introduction-to-fine-grained-reactivity-3ndf)
- [Async Tracking in SolidJS](https://www.solidjs.com/guides/reactivity#async-tracking)
- [Store API Documentation](https://www.solidjs.com/docs/latest/api#createstore)
- [Best Practices for Store Usage](https://github.com/solidjs/solid/discussions/397) 