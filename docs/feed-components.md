# Компоненты управления лентой

## Фильтры и сортировка

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
  AllTime = 'all',
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year'
}

// В GraphQL передаем timestamp
interface FeedFilters {
  after?: number // Unix timestamp в секундах
}

// Преобразование периода в timestamp
const after = period === PeriodType.AllTime 
  ? undefined 
  : Math.floor(getTimestampFromPeriod(period) / 1000)
```

3. **Отобранное** [FeedFiltersControl.tsx](../src/components/Feed/FeedFiltersControl.tsx#L58-L68)

Фильтр для работы с избранными материалами. Может находиться в трех состояниях:
- `all` - показывать все материалы
- `featured` - только избранные
- `unfeatured` - только не избранные

```typescript
// В UI
type FeaturedFilter = 'featured' | 'unfeatured' | 'all'

// В GraphQL
interface FeedFilters {
  featured?: boolean
}

// Преобразование
const featuredFilterHandler = (opt: Option) => {
  const mode = opt.value as FeaturedFilter
  updateFilters({
    featured: mode === 'featured' ? true : mode === 'unfeatured' ? false : undefined
  })
}
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