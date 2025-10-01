# Компоненты управления лентой

## Фильтры и сортировка

### Архитектура фильтрации

Система фильтрации построена на основе реактивного контекста `useFeed()`. Все изменения фильтров автоматически триггерят перезагрузку данных.

#### Поток данных фильтров:
1. **UI компоненты** (`FeedSwitcher`, `FeedFiltersControl`) обновляют состояние фильтров
2. **Контекст feed** отслеживает изменения через `filterState.timestamp`  
3. **Эффект перезагрузки** автоматически вызывает соответствующий `loadFeed()`
4. **GraphQL запрос** отправляется с объединенными фильтрами

```typescript
// Пример объединения фильтров в loadFeed()
const mergedOptions: LoadShoutsOptions = {
  ...options(),
  ...opts,
  order_by: opts?.order_by ?? orderByMode(mode as FeedMode),
  filters: {
    ...currentFilters, // из filterState()
    ...opts?.filters   // переданные напрямую
  }
}
```

### Типы лент

#### 1. Основные режимы сортировки
- `recent` - сортировка по дате создания (по умолчанию)
- `hot` - по активности, учитывает недавние комментарии
- `top` - по рейтингу

#### 2. Персональные ленты (требуют авторизации)
- `followed` - материалы от отслеживаемых авторов
- `discussed` - материалы с активными обсуждениями
- `coauthored` - материалы в соавторстве

### Типы фильтров

1. **Layouts (типы контента)** [FeedFiltersControl.tsx](../src/components/Feed/FeedFiltersControl.tsx#L70-L82)

Фильтр по типу контента позволяет комбинировать разные форматы. Пользователь может выбрать несколько типов одновременно - в этом случае будут показаны материалы всех выбранных типов.

```typescript
// В UI можно выбрать несколько типов
const EXPO_LAYOUTS = ['audio', 'video', 'literature', 'image']

// В GraphQL уходит как массив
interface FeedFilters {
  layouts?: InputMaybe<string>[] // Можно выбрать несколько
}

// Пример запроса
{
  layouts: ['video', 'audio'] // Покажет видео И аудио
}

// Обработка в UI - см. layoutsOptionsGroupHandler в FeedFiltersControl.tsx
```

2. **Временные периоды** [fromPeriod.ts](../src/lib/fromPeriod.ts#L1-L20)

Фильтр по времени публикации. В UI показываем человекопонятные периоды (день/неделя/месяц), но в API отправляем конкретную временную метку. Все материалы после этой метки будут включены в выборку.

```typescript
// В UI используем enum
enum PeriodType {
  AllTime = 'all_time',
  Day = 'day', 
  Week = 'week',
  Month = 'month',
  Year = 'year'
}

// В GraphQL отправляем Unix timestamp
interface FeedFilters {
  after?: number // Unix timestamp в секундах
}

// Преобразование в utils
const getTimestampFromPeriod = (period: PeriodType): number => {
  const now = Date.now() / 1000
  switch (period) {
    case PeriodType.Day: return now - 86400
    case PeriodType.Week: return now - 604800
    case PeriodType.Month: return now - 2592000
    case PeriodType.Year: return now - 31536000
    default: return 0
  }
}
```

3. **Featured фильтр** [FeedFiltersControl.tsx](../src/components/Feed/FeedFiltersControl.tsx#L95-L110)

Позволяет показать только избранные материалы, только неизбранные, или все.

```typescript
type FeaturedFilter = 'featured' | 'unfeatured' | 'all'

// В GraphQL
interface FeedFilters {
  featured?: boolean // true/false/undefined
}

// Логика преобразования
const featuredValue = filter === 'featured' ? true 
                    : filter === 'unfeatured' ? false 
                    : undefined
```

### Автоматическая синхронизация

#### Контекст feed [feed.tsx](../src/context/feed.tsx#L400-L470)

```typescript
// Эффект для автоматической перезагрузки при изменении фильтров
createEffect(
  on(
    () => filterState().timestamp,
    (timestamp, prevTimestamp) => {
      if (timestamp !== prevTimestamp && prevTimestamp !== undefined) {
        const currentMode = mode()
        const setter = feedSetters[currentMode]
        if (setter) {
          setter(emptyFeed) // Очищаем текущие данные
          
          // Загружаем с новыми фильтрами
          switch (currentMode) {
            case 'hot': loadHotFeed(); break
            case 'top': loadTopFeed(); break  
            default: loadRecentFeed(); break
          }
        }
      }
    },
    { defer: true }
  )
)
```

#### Компоненты фильтров

**FeedSwitcher** - управляет сортировкой:
```typescript
// Обновляет options.order_by и сбрасывает offset
updateOptions({
  offset: 0,
  order_by: orderByMode(value as FeedMode)
})
```

**FeedFiltersControl** - управляет фильтрами:
```typescript  
// Прямо обновляет filterState через updateFilters()
updateFilters({
  after: period === PeriodType.AllTime ? undefined : getTimestampFromPeriod(period)
})
```

### Совместимость

#### SSR и специфические запросы
Для специфических случаев используются разные подходы:

**AuthorView** - полностью интегрирован с системой фильтров и сортировки:
```typescript
// Объединяет фильтр автора с пользовательскими фильтрами и опциями сортировки
const loadAuthorShouts = async (offset = 0) => {
  const currentFilters = filterState().filters
  const currentOptions = options()
  const mergedFilters = {
    ...currentFilters,
    author: author()!.slug  // Всегда фильтруем по автору
  }
  
  return loadShouts({
    options: {
      ...currentOptions,  // Включает order_by из FeedSwitcher
      filters: mergedFilters,
      limit: FEED_PAGE_SIZE,
      offset
    }
  })()
}

// Автоматическая перезагрузка при изменении фильтров или сортировки
createEffect(on(
  () => filterState().timestamp,
  () => {
    if (author() && !currentTab()) { // Только на вкладке публикаций
      loadAuthorShouts(0).then(setSortedFeed)
    }
  }
))

// UI включает и FeedSwitcher и FeedFiltersControl
<div class={styles.filtersRow}>
  <FeedSwitcher
    options={['recent', 'top', 'hot']}
    prefix={`/@${props.authorSlug}`}
    class={styles.feedSwitcher}
  />
  <FeedFiltersControl />
</div>
```

**TopicView** - аналогично интегрирован с фильтрами для публикаций темы

**Другие представления** - используют прямые вызовы `loadShouts()`:
```typescript
// Для других специфических запросов сохранен прямой вызов
const fetcher = loadShouts({
  options: {
    filters: { /* специфические фильтры */ },
    limit: FEED_PAGE_SIZE,
    offset
  }
})
```

#### Кеширование  
Публичные запросы используют кеширование через `createCacheableLoader()`, персональные ленты - через обычный GraphQL клиент.

### Отладка

Для отладки фильтрации включены консольные логи:
```typescript
console.log('[FeedProvider] Filters changed, reloading feed:', currentMode)
console.log('[FeedProvider] Feed mode changed:', currentMode)
```

Также можно отслеживать состояние фильтров через React DevTools или в браузере:
```javascript
// В консоли браузера
window.feedState = /* результат useFeed() */
console.log(window.feedState.filterState())
```

### Состояние фильтров [filters.ts](../src/types/filters.ts)

Фильтры хранятся в едином состоянии с временной меткой последнего обновления. Это позволяет:
1. Отслеживать изменения для синхронизации с URL
2. Избегать лишних запросов при быстрых изменениях
3. Поддерживать разные наборы фильтров для разных типов контента

```typescript
// Общий интерфейс состояния
interface FilterState {
  filters: FeedFilters | CommentsFilters
  timestamp: number // Для отслеживания изменений
}

// Для ленты публикаций
interface FeedFilters {
  after?: number
  featured?: boolean
  layouts?: InputMaybe<string>[]
}

// Для комментариев 
interface CommentsFilters {
  after?: number
  sort?: ReactionSort
}
```

### Обработка крайних случаев [FeedProvider.tsx](../src/context/feed.tsx#L200-L240)

1. **Пустые результаты** - возвращаем пустой фид с флагом отсутствия дополнительных страниц

```typescript
if (!result?.length) {
  return emptyFeed // { shouts: [], isLoading: false, hasMore: false }
}
```

2. **Дедупликация** - проверяем ID материалов чтобы избежать дублей при подгрузке

```typescript
const existingIds = new Set(existingFeed.shouts.map(s => s.id))
const uniqueShouts = shouts.filter(s => !existingIds.has(s.id))
```

3. **Пагинация** - проверяем количество загруженных материалов для определения наличия следующей страницы

```typescript
const hasMore = shouts.length >= FEED_PAGE_SIZE
const newShouts = offset ? [...prev.shouts, ...uniqueShouts] : uniqueShouts
```

### Синхронизация с URL [FeedProvider.tsx](../src/context/feed.tsx#L450-L480)

URL должен отражать текущее состояние фильтров для:
1. Возможности делиться ссылками на отфильтрованную ленту
2. Корректной работы навигации браузера (back/forward)
3. Восстановления состояния при перезагрузке страницы

```typescript
// Эффект синхронизации с URL
createEffect(on(filterState, (state) => {
  const params = new URLSearchParams(location.search)
  
  if (state.filters.after) {
    const period = getPeriodFromTimestamp(state.filters.after)
    params.set('period', period)
  }
  
  if (state.filters.layouts?.length) {
    params.set('layouts', state.filters.layouts.join(','))
  }
  
  history.replaceState(null, '', `?${params}`)
}))
```

### Взаимодействие компонентов

Компоненты образуют иерархию:
1. `FeedView` - основной контейнер, управляет общим состоянием:
   - Управляет загрузкой данных
   - Обрабатывает пагинацию
   - Содержит сайдбар с дополнительной информацией
2. `FeedSwitcher` - переключает режимы сортировки
3. `FeedFiltersControl` - управляет фильтрами
4. `FeedProvider` - обеспечивает доступ к данным:
   - Хранит состояние всех типов фидов (recent, hot, top и др.)
   - Предоставляет методы загрузки данных
   - Управляет группировками и рейтингами
   - Отслеживает просмотренные материалы

```
FeedView [../src/components/Views/FeedView.tsx]
├── FeedSwitcher [../src/components/Feed/FeedSwitcher/FeedSwitcher.tsx]
├── FeedFiltersControl [../src/components/Feed/FeedFiltersControl.tsx]
└── FeedProvider [../src/context/feed.tsx]
```

### Оптимизации

1. **Реактивные вычисления** [FeedProvider.tsx](../src/context/feed.tsx#L130-L150)

Используем `createMemo` для автоматического отслеживания зависимостей и обновления только при их изменении:

```typescript
const currentFeed = createMemo(() => {
  switch (mode()) {
    case 'hot': return hotFeed()
    case 'top': return topFeed()
    default: return recentFeed()
  }
})
```

2. **Отложенная реактивность** [FeedProvider.tsx](../src/context/feed.tsx#L460-L480)

Используем `{ defer: true }` в эффектах для предотвращения циклических обновлений:

```typescript
createEffect(on(mode, loadCurrentFeed, { defer: true }))
```

3. **Гранулярная реактивность** [FeedFiltersControl.tsx](../src/components/Feed/FeedFiltersControl.tsx#L40-L60)

Разделяем состояние на мелкие сигналы для точечных обновлений:

```typescript
const [currentPeriod, setCurrentPeriod] = createSignal<PeriodType>(PeriodType.AllTime)
const [currentFeaturedFilter, setCurrentFeaturedFilter] = createSignal<FeaturedFilter>('all')

// Обновляется только при изменении конкретного фильтра
createEffect(on(currentPeriod, (period) => {
  updateFilters({
    after: period === PeriodType.AllTime ? undefined : getTimestampFromPeriod(period)
  })
}))
```

### Дополнительные материалы
- [Фильтры комментариев](./comments-filter.md) - специфика фильтрации комментариев

## FeedCustomization Component Upgrade

### Overview

The `FeedCustomization` component has been upgraded with improved styling, animations, and a new illustration variant featuring an archer theme (bow, arrow, target).

### Variants

The component now supports two display variants:

#### 1. Illustration Variant (Default)
- Features animated CSS illustrations (bow, arrow, target)
- Gradient background with subtle animations
- Enhanced visual feedback with hover effects
- Better responsive design

```tsx
<FeedCustomization
  variant="illustration"
  title=""
  description={t('Subscribe to your favorite topics, authors and communities')}
/>
```

#### 2. Image Variant (Legacy)
- Uses background image
- Maintains existing functionality
- Fallback for older implementations

```tsx
<FeedCustomization
  variant="image"
  title={t('Create your feed')}
  description={t('Subscribe to interesting topics and authors')}
/>
```

### New Features

1. **Advanced CSS Animations**: Floating arrows, pulsing bow, rotating target
2. **Improved Responsiveness**: Better layout for mobile and desktop
3. **Enhanced Hover Effects**: Smooth transitions and visual feedback
4. **Better Typography**: Improved text shadows and readability

### Styling Enhancements

- Added `@keyframes` animations for all interactive elements
- Improved gradient backgrounds with animation
- Enhanced button styling with shimmer effects
- Better mobile responsiveness with media queries

## AsideSection Component Improvements

### New Props

The `AsideSection` component has been enhanced with additional configuration options:

```tsx
interface AsideSectionProps {
  title?: string
  children: JSX.Element
  class?: string
  collapsible?: boolean
  defaultExpanded?: boolean
  icon?: string
  variant?: 'default' | 'card' | 'minimal'  // NEW
  noPadding?: boolean                       // NEW
  noBackground?: boolean                    // NEW
}
```

### Variants

#### 1. Default Variant
- Standard aside section with background and padding
- Hover effects and shadows

#### 2. Card Variant
- Transparent background
- Designed for special card components
- No default padding or background styling

```tsx
<AsideSection variant="card" noPadding>
  <CustomCard />
</AsideSection>
```

#### 3. Minimal Variant
- Minimal styling for simple content
- Reduced spacing and simplified headers

```tsx
<AsideSection variant="minimal" title="Simple Section">
  <SimpleContent />
</AsideSection>
```

### Usage in FeedView

The FeedView now uses the improved components:

```tsx
<FeedCustomization
  title={''}
  description={t('Subscribe to your favorite topics, authors and communities')}
  variant="illustration"
/>
```

### Translation Keys Added

- `"Hit the target"` - Heading for illustration variant
- `"Fine-tune your feed to get exactly the content you want to read"` - Description text

### Performance Optimizations

1. **CSS Animations**: Hardware-accelerated transforms
2. **Efficient Styling**: Reduced CSS specificity and improved organization
3. **Better Caching**: Improved component memoization