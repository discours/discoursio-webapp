# Борьба с циклическими эффектами в SolidJS

## Проблема

Циклические эффекты - одна из самых сложных проблем в реактивных системах. Они возникают когда:
1. Эффект A зависит от сигнала B
2. Эффект B зависит от сигнала A
3. Изменение одного вызывает бесконечную цепочку обновлений

В нашем коде такая проблема часто встречается при работе с фидами и фильтрами:

```typescript
// ❌ Циклическая зависимость в src/context/feed.tsx
createEffect(() => {
  setFeedByMode(currentFeed()) // Зависит от currentFeed
})

createEffect(() => {
  setCurrentFeed(feedByMode()) // Зависит от feedByMode
})
```

Это приводит к бесконечным обновлениям и падению производительности.

## Решения

### 1. Использование `on` с defer

Самый простой способ разорвать цикл - использовать `defer: true`. Это откладывает выполнение эффекта до следующего цикла обновлений:

```typescript
// ✅ Отложенное обновление в src/components/Views/TopicView.tsx
createEffect(
  on(
    () => feedByTopic()[props.topicSlug],
    (authorFeed) => {
      if (authorFeed?.length) {
        setSortedFeed(authorFeed)
        setLoadMoreHidden(authorFeed.length >= stats().shouts)
      }
    },
    { defer: true }
  )
)
```

Этот паттерн особенно полезен когда:
- Нужно дождаться стабилизации других эффектов
- Порядок обновлений важен
- Есть риск циклических зависимостей

### 2. Группировка обновлений через `batch`

Когда нужно обновить несколько связанных состояний, используем `batch`. Это предотвращает промежуточные ререндеры:

```typescript
// ✅ Атомарное обновление в src/context/following.tsx
createEffect(
  on(follows, (data) => {
    if (!data) return
    batch(() => {
      setState(prev => ({
        ...prev,
        authors: data.authors || [],
        topics: data.topics || [],
        communities: data.communities || []
      }))
    })
  }, { defer: true })
)
```

Batch особенно важен когда:
- Обновляется несколько связанных состояний
- Промежуточные состояния невалидны
- Важна производительность

### 3. Изоляция через `untrack`

Иногда нужно прочитать значение сигнала без создания зависимости. Для этого используем `untrack`:

```typescript
// ✅ Безопасное чтение сессии в src/context/session.tsx
const getToken = () => untrack(() => session()?.token)

const [client] = createResource(
  getToken,
  async (token) => {
    if (!token) return null
    return graphqlClientCreate(coreApiUrl, token)
  }
)
```

`untrack` полезен когда:
- Нужно прочитать значение без отслеживания
- Есть риск циклических зависимостей
- Значение используется только для вычислений

### 4. Комплексный подход с изолированным обновлением данных

Для наиболее сложных случаев можно применить комплексный подход, изолируя обновление состояний в отдельные функции и используя мемоизацию:

```typescript
// ✅ Изолированная обработка данных в LoadMoreWrapper
// Вычисляем производные значения через createMemo
const itemsLength = createMemo(() => items().length)
const shouldHideLoadMore = createMemo(() => {
  const len = itemsLength()
  return len > 0 && len % props.pageSize !== 0
})

// Изолированная функция для безопасного обновления состояний
const safeUpdateState = (newItems: LoadMoreItems) => {
  // Выполняем все обновления вне отслеживания реактивности
  untrack(() => {
    // Группируем все обновления состояний
    batch(() => {
      setItems((prev) => {
        const merged = [...prev, ...uniqueNewItems].sort(byCreated)
        
        // Обновляем зависимые состояния внутри одной транзакции
        setOffset(merged.length)
        
        return merged
      })
      
      // Другие обновления состояния...
      setIsLoadMoreButtonVisible(uniqueNewItems.length >= props.pageSize)
    })
  })
}

// Используем defer для предотвращения каскадных обновлений
createEffect(
  on(itemsLength, (length) => {
    console.log('Items updated:', length)
    if (shouldHideLoadMore()) {
      setIsLoadMoreButtonVisible(false)
    }
  }, { defer: true })
)
```

Этот паттерн помогает в сложных случаях, когда:
- Имеется множество взаимосвязанных состояний
- Нужна тонкая гранулярность контроля над обновлениями
- Важна производительность и предотвращение циклических зависимостей

## Продвинутые паттерны

### 1. Отложенная загрузка данных

В реальных приложениях часто нужно загружать данные в ответ на изменения состояния. Важно делать это правильно:

```typescript
// ✅ Умная загрузка в src/routes/feed/[...mode].tsx
createEffect(
  on(mode, async (currentMode) => {
    if (!currentMode) return

    try {
      const [newComments, newUnrated] = await Promise.all([
        loadReactions({
          by: { kinds: [ReactionKind.Comment], sort: ReactionSort.Newest },
          limit: 3
        })(),
        loadUnratedShouts({ limit: 5, offset: 0 })()
      ])

      if (newComments) setRecentComments(newComments)
      if (newUnrated) setUnratedShouts(newUnrated)
    } catch (error) {
      console.error('[FeedPage] Error loading additional data:', error)
    }
  }, { defer: true })
)
```

Ключевые моменты:
- Используем `defer` для предотвращения race conditions
- Группируем запросы через Promise.all
- Правильно обрабатываем ошибки

### 2. Мемоизация с проверкой изменений

Часто нужно обновлять состояние только если данные действительно изменились:

```typescript
// ✅ Умное обновление в src/components/Feed/Sidebar/Sidebar.tsx
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

Этот паттерн помогает:
- Избежать ненужных обновлений
- Предотвратить циклические зависимости
- Оптимизировать производительность

### 3. Кеширование с отложенной валидацией

В нашем приложении активно используется кеширование с валидацией по времени:

```typescript
// ✅ Умное кеширование в src/context/topics.tsx
const [topics] = createResource(
  getToken,
  async (token) => {
    const cached = await loadFromCache()
    const needsUpdate = await shouldUpdateTopics()
    
    if (cached?.length && !needsUpdate) {
      return cached
    }

    const result = await loadTopics()()
    if (result?.length) {
      await saveToCache(result)
      updateLastUpdateTime()
      return result
    }

    return cached || []
  }
)
```

Преимущества этого подхода:
- Мгновенный ответ из кеша
- Фоновое обновление при необходимости
- Экономия трафика

## Отладка

### 1. Логирование циклов

Для отладки циклических обновлений используем счетчик рендеров:

```typescript
// ✅ Отслеживание циклов в src/app.tsx
createRenderEffect(() => {
  console.log('[Providers] Render cycle:', ++updateCount)
  if (updateCount > 100) {
    console.error('[Providers] Too many updates, possible infinite loop')
    console.trace()
  }
  onCleanup(() => updateCount--)
})
```

Это помогает:
- Найти источник циклических обновлений
- Измерить производительность
- Отладить сложные взаимодействия

### 2. Правильный порядок провайдеров

Порядок провайдеров критически важен для предотвращения циклических зависимостей:

```typescript
// ✅ Оптимальный порядок в src/app.tsx
<LocalizeProvider>
  <SessionProvider>
    <UIProvider>
      <TopicsProvider>
        <AuthorsProvider>
          <FeedProvider>
            <EditorProvider>
              <FeaturedFeedProvider>
                <FollowingProvider>
                  {children}
                </FollowingProvider>
              </FeaturedFeedProvider>
            </EditorProvider>
          </FeedProvider>
        </AuthorsProvider>
      </TopicsProvider>
    </UIProvider>
  </SessionProvider>
</LocalizeProvider>
```

Важные правила:
- Базовые провайдеры (сессия, UI) идут первыми
- Зависимые провайдеры идут после своих зависимостей
- Специфичные провайдеры идут последними

## Дополнительные материалы

- [SolidJS Reactivity Guide](https://www.solidjs.com/guides/reactivity)
- [Understanding Solid's Effects](https://www.solidjs.com/guides/reactivity#effects)
- [Batching Updates](https://www.solidjs.com/docs/latest/api#batch)
- [Debugging Reactivity](https://www.solidjs.com/guides/debugging)
