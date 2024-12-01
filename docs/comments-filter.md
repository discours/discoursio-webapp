# Фильтрация комментариев

## Общая архитектура

```
CommentsTree
├── CommentsFilter (фильтры)
└── ReactionsProvider (состояние)
```

## CommentsFilter

Управляет фильтрацией и сортировкой комментариев:

### Параметры фильтрации
```typescript
export type CommentsFilterOptions = {
  kind?: ReactionKind      // Тип реакции (COMMENT)
  sort?: ReactionSort      // Сортировка (Newest | Like)
  after?: number          // Временной период
}
```

### Фильтры по периоду
```typescript
enum PeriodType {
  AllTime = 'all',    // Все время
  Day = 'day',        // За день
  Week = 'week',      // За неделю
  Month = 'month',    // За месяц
  Year = 'year'       // За год
}
```

### Логика работы
1. Отслеживает изменения периода и сортировки:
```typescript
createEffect(
  on(
    [currentPeriod, currentSort],
    async ([period, sort]) => {
      const after = period === PeriodType.AllTime 
        ? undefined 
        : getTimestampFromPeriod(period)
      
      props.onChange?.({ kind: ReactionKind.Comment, sort, after })
    }
  )
)
```

2. Обновляет состояние через ReactionsProvider:
```typescript
const handleFiltersChange = (filters: CommentsFilterOptions) => {
  setCommentsOrder(filters.sort || ReactionSort.Newest)
  loadReactionsBy({ 
    by: { 
      shout: props.shoutSlug,
      kinds: [ReactionKind.Comment],
      after: filters.after
    }
  })
}
```

## Особенности реализации

### Сортировка
- `Newest` - по дате создания
- `Like` - по количеству лайков
- Оптимистичные обновления при голосовании

### Периоды
- Динамический расчет временных интервалов
- Учет часовых поясов
- Кэширование результатов

### Оптимизации
1. Мемоизация отфильтрованных комментариев:
```typescript
const sortedComments = createMemo(() => {
  let filtered = [...comments()]
  
  if (commentsOrder() === ReactionSort.Like) {
    filtered = filtered.sort(byStat('rating'))
  }
  
  return filtered.sort(byCreated).reverse()
})
```

2. Дедупликация при загрузке:
```typescript
const uniqueComments = Array.from(
  new Map(comments.map(c => [c.id, c])).values()
)
```

3. Ленивая загрузка:
```typescript
<LoadMoreWrapper
  loadFunction={loadMoreComments}
  pageSize={COMMENTS_PER_PAGE}
  hidden={loadMoreHidden()}
>
  {/* comments list */}
</LoadMoreWrapper>
```

## Взаимодействие с другими компонентами

### ReactionsProvider
- Хранит состояние комментариев
- Обрабатывает CRUD операции
- Синхронизирует данные между вкладками

### CommentsTree
- Отображает отфильтрованные комментарии
- Управляет состоянием загрузки
- Обрабатывает пагинацию

### MiniEditor
- Создание новых комментариев
- Оптимистичные обновления
- Валидация контента 

## Трансформация данных

### Временные периоды
```typescript
// В UI используется enum для удобства
enum PeriodType {
  AllTime = 'all',    
  Day = 'day',        
  Week = 'week',      
  Month = 'month',    
  Year = 'year'       
}

// Преобразование в Unix timestamp (секунды)
const getTimestampFromPeriod = (period: PeriodType): number => {
  const now = Math.floor(Date.now() / 1000) // текущее время в секундах
  switch (period) {
    case PeriodType.Day:
      return now - 24 * 60 * 60     // -1 день
    case PeriodType.Week:
      return now - 7 * 24 * 60 * 60 // -7 дней
    case PeriodType.Month:
      return now - 30 * 24 * 60 * 60 // -30 дней
    case PeriodType.Year:
      return now - 365 * 24 * 60 * 60 // -365 дней
    default:
      return 0
  }
}
```

### Параметры запроса
```typescript
// В UI
type CommentsFilterOptions = {
  kind?: ReactionKind
  sort?: ReactionSort     // enum для UI
  after?: number         // Unix timestamp в секундах
}

// Для GraphQL (один формат с UI)
type QueryLoad_Reactions_ByArgs = {
  by: {
    shout: string
    kinds: ReactionKind[]
    after?: number       // Unix timestamp в секундах
  }
}

// Прямая передача без преобразования
const handleFiltersChange = (filters: CommentsFilterOptions) => {
  loadReactionsBy({ 
    by: { 
      shout: props.shoutSlug,
      kinds: [ReactionKind.Comment],
      after: filters.after // уже в секундах
    }
  })
}
```

### Особенности
1. **Временные метки**
   - Везде используются Unix timestamps в секундах
   - Нет преобразований между UI и GraphQL
   - Конвертация в секунды происходит только в getTimestampFromPeriod

2. **Валидация**
   - Проверка корректности временных интервалов
   - Нормализация пустых значений в undefined
   - Защита от некорректных enum значений

3. **Кэширование**
   - Кэширование результатов преобразования дат
   - Мемоизация параметров сортировки
   - Переиспользование GraphQL запросов