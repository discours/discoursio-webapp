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
// ❌ Было - создание объекта при каждом вычислении
const feeds = {
  recent: recentFeed,
  hot: hotFeed,
  top: topFeed
}

// ✅ Стало - мемоизация с отложенной загрузкой
createEffect(
  on(
    mode,
    (currentMode) => {
      console.log('[FeedProvider] Feed mode changed:', {
        mode: currentMode,
        client: !!client()
      })

      // Определяем тип ленты
      const isPersonalFeed = ['followed', 'discussed', 'coauthored'].includes(currentMode)

      // Сначала загружаем новые данные
      const loadPromise = Promise.resolve().then(() => {
        if (isPersonalFeed && !client()) return

        switch (currentMode) {
          case 'followed':
            return loadFollowedFeed()
          case 'discussed':
            return loadDiscussedFeed()
          case 'coauthored':
            return loadCoauthoredFeed()
          case 'hot':
            return loadHotFeed()
          case 'top':
            return loadTopFeed()
          default:
            return loadRecentFeed()
        }
      })

      // Только после загрузки очищаем старые данные
      loadPromise.then(() => {
        batch(() => {
          setMyRates({})
          updateOptions({ offset: 0 })
        })
      })
    },
    { defer: true }
  )
)
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

### 4. Атомарные сигналы [TopicsProvider.tsx](../src/context/topics.tsx)

```typescript
// ❌ Было - большой монолитный стейт
const [state, setState] = createStore({
  entities: {},
  sorted: [],
  sortBy: 'shouts',
  random: undefined,
  loading: true
})

// ✅ Стало - атомарные сигналы и производные состояния
const [entities, setEntities] = createSignal<Record<string, Topic>>({})
const [sortBy, setSortBy] = createSignal<TopicSort>('shouts')
const [loading, setLoading] = createSignal(true)

// Производные состояния через createMemo
const sorted = createMemo(() => 
  Object.values(entities()).sort(byTopicStatDesc(sortBy()))
)

const random = createMemo(() => sorted()[0])
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
  const feeds: Record<FeedMode, () => FeedState> = {
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

### 3. Solid.js отличия от React:
- Используйте атомарные сигналы вместо большого состояния
- Применяйте createMemo для производных данных
- Избегайте ненужной вложенности состояний
- createStore только для вложенных объектов

### 4. Оптимизация производительности:
- Кэшируйте промежуточные результаты через сигналы
- Проверяйте реальные изменения перед пересчетом
- Изолируйте вычисления от состояния через untrack
- Используйте defer для предотвращения каскадных обновлений

## Важные моменты

1. **Используйте createMemo для:**
   - Сложных вычислений (сортировка, фильтрация)
   - Преобразования данных для UI
   - Кэширования результатов запросов

2. **Избегайте createMemo для:**
   - Простых операций
   - Прямого доступа к сигналам
   - Единичных преобразований

3. **Solid.js отличия от React:**
   - Используйте атомарные сигналы вместо большого состояния
   - Применяйте createMemo для производных данных
   - Избегайте ненужной вложенности состояний
   - createStore только для вложенных объектов

4. **Оптимизация производительности:**
   - Кэшируйте промежуточные результаты через сигналы
   - Проверяйте реальные изменения перед пересчетом
   - Изолируйте вычисления от состояния через untrack
   - Используйте defer для предотвращения каскадных обновл��ний

## Дополнительные материалы

- [Fine-grained Reactivity](https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity)
- [Understanding Solid's Signals](https://docs.solidjs.com/concepts/signals)
- [Ryan's Reactivity Deep Dive](https://dev.to/ryansolid/a-hands-on-introduction-to-fine-grained-reactivity-3ndf)
- [Solid Store vs Signals](https://www.solidjs.com/guides/reactivity#stores)
- [Optimizing Reactivity](https://www.solidjs.com/guides/reactivity#optimizing)