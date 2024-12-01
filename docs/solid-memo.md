# Мемоизация в SolidJS

## Примеры из нашей кодовой базы

### 1. Группировка и сортировка [TopicView.tsx](../src/components/Views/TopicView.tsx)

```typescript
// ❌ Было - избыточные вычисления при каждом рендере
const topViewedShouts = createMemo(() => {
  const loaded = feedByTopic()?.[props.topicSlug] || []
  return [...loaded].sort(byStat('views'))
})

// ✅ Стало - кэширование результатов и проверка изменений
const [prevFeed, setPrevFeed] = createSignal<Shout[]>([])
const [prevSorted, setPrevSorted] = createSignal<Shout[]>([])

const topicFeed = () => feedByTopic()?.[props.topicSlug] || []

const topViewedShouts = createMemo(() => {
  const feed = topicFeed()
  
  // Проверяем равенство массивов
  const isEqual = feed.length === prevFeed().length && 
    feed.every((item, i) => item.id === prevFeed()[i]?.id)
  
  if (isEqual) return prevSorted()
  
  setPrevFeed(feed)
  const sorted = [...feed].sort((a: Shout, b: Shout) => {
    const aViews = (a.stat as Stat)?.viewed || 0
    const bViews = (b.stat as Stat)?.viewed || 0
    return bViews - aViews
  })
  setPrevSorted(sorted)
  
  return sorted
})
```

### 2. Управление фидами [FeedProvider.tsx](../src/context/feed.tsx)

```typescript
// ❌ Было - смешивание вычислений и доступа к состоянию
const feedByMode = createMemo(() => {
  switch (mode()) {
    case 'hot': return hotFeed()
    case 'top': return topFeed()
    default: return recentFeed()
  }
})

// ✅ Стало - изоляция вычислений и кэширование
const currentMode = () => mode()
const feedByMode = createMemo(() => {
  const feeds: Record<FeedMode, () => FeedStore> = {
    hot: hotFeed,
    top: topFeed,
    recent: recentFeed,
    followed: followedFeed,
    discussed: discussedFeed,
    coauthored: coauthoredFeed,
    search: searchFeed,
    comments: recentFeed
  }
  return feeds[currentMode()]?.() || recentFeed()
})
```

### 3. Параметры загрузки [FeedPage.tsx](../src/routes/feed/[...mode].tsx)

```typescript
// ❌ Было - пересоздание объекта при каждом рендере
const loadParams = () => ({
  options: {
    ...options(),
    order_by: orderByMode(mode())
  }
})

// ✅ Стало - мемоизация параметров
const loadParams = createMemo(() => ({
  options: {
    ...options(),
    order_by: orderByMode(mode())
  }
}))
```

## Рекомендации по оптимизации

### 1. Кэширование результатов
```typescript
// В TopicView.tsx
const [prevFeed, setPrevFeed] = createSignal<Shout[]>([])
const [prevSorted, setPrevSorted] = createSignal<Shout[]>([])

// Проверяем изменения перед пересчетом
if (isEqual) return prevSorted()
```

### 2. Изоляция вычислений
```typescript
// В FeedProvider.tsx
const currentMode = () => mode()
const feedByMode = createMemo(() => {
  const feeds = { /*...*/ }
  return feeds[currentMode()]?.() || recentFeed()
})
```

### 3. Предотвращение лишних обновлений
```typescript
// В FeedProvider.tsx
createEffect(() => {
  const feed = currentFeed()
  const currentMode = mode()
  const currentSetter = feedSetters[currentMode]
  
  if (!feedByMode().shouts.includes(feed.shouts[0])) {
    currentSetter({
      shouts: feed.shouts,
      isLoading: false,
      hasMore: feed.shouts.length >= FEED_PAGE_SIZE
    })
  }
})
```

## Важные моменты

1. **Используйте createMemo для:**
   - Сложных вычислений (сортировка, фильтрация)
   - Преобразования данных для UI
   - Кэширования результатов запросов

2. **Избегайте createMemo для:**
   - Простых операций
   - Прямого доступа к сигналам
   - Единичных преобразований

3. **Оптимизируйте через:**
   - Кэширование промежуточных результатов
   - Проверку изменений перед пересчетом
   - Изоляцию вычислений от состояния

## Дополнительные материалы

- [Fine-grained Reactivity](https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity)
- [Understanding Solid's Signals](https://docs.solidjs.com/concepts/signals)
- [Ryan's Reactivity Deep Dive](https://dev.to/ryansolid/a-hands-on-introduction-to-fine-grained-reactivity-3ndf)