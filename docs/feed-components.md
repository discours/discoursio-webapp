# Компоненты управления лентой

## Общая архитектура

```
FeedView
├── FeedSwitcher (режимы ленты)
├── FeedFilters (фильтры)
└── FeedProvider (состояние)
```

## FeedSwitcher

Управляет режимами отображения ленты:

```typescript
type ViewOption = 'recent' | 'hot' | 'top' | 'followed' | 'discussed' | 'coauthored' | 'search'
```

### Логика работы
1. Синхронизирует URL с текущим режимом
2. Обновляет параметры сортировки через `updateOptions`
3. Сбрасывает offset при смене режима
4. Поддерживает счетчики для каждого режима

## FeedFilters

Управляет дополнительными фильтрами:

### Фильтры по периоду
```typescript
enum PeriodType {
  AllTime = 'all',
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year'
}
```

### Фильтры по типу контента
```typescript
const EXPO_LAYOUTS = [
  'audio',
  'video', 
  'literature',
  'image'
]
```

### Логика работы
1. Синхронизирует состояние с URL
2. Обновляет параметры через `updateOptions`
3. Поддерживает множественный выбор для layouts
4. Сохраняет состояние в IndexedDB

## FeedProvider

Управляет состоянием и загрузкой данных:

### Хранилища
```typescript
interface FeedStore {
  shouts: Shout[]
  isLoading: boolean
  hasMore: boolean
  error?: Error
}

// Отдельные хранилища для каждого режима
recentFeed: FeedStore
hotFeed: FeedStore
topFeed: FeedStore
// ...
```

### Группировки
- `feedByLayout` - группировка по типу контента
- `feedByTopic` - группировка по темам
- `feedByAuthor` - группировка по авторам
- `feedByMode` - текущий активный фид

### Оптимизации
1. Мемоизация текущего фида:
```typescript
const currentFeed = createMemo(() => {
  switch (mode()) {
    case 'hot': return hotFeed()
    case 'top': return topFeed()
    // ...
  }
})
```

2. Дедупликация при добавлении:
```typescript
const uniqueShouts = shouts.filter(s => !existingIds.has(s.id))
```

3. Батчинг обновлений:
```typescript
Promise.resolve().then(() => {
  setFeedByMode(newFeed)
})
```

### Порядок обновлений
1. Смена режима в URL
2. Обновление FeedSwitcher
3. Сброс параметров в FeedFilters
4. Загрузка нового контента
5. Обновление группировок
6. Обновление UI

## Взаимодействие компонентов

```
URL изменение
  ↓
FeedSwitcher (обновляет режим)
  ↓
FeedProvider (загружает данные)
  ↓
FeedFilters (применяет фильтры)
  ↓
FeedView (отображает результат)
```

## Особенности реализации

1. **Оптимистичные обновления**
   - Мгновенное обновление UI
   - Фоновая синхронизация
   - Откат при ошибках

2. **Кэширование**
   - Сохранение состояния фильтров
   - Кэширование загруженных данных
   - Предзагрузка следующей страницы

3. **Производительность**
   - Виртуализация списков
   - Ленивая загрузка изображений
   - Дебаунс обновлений фильтров 