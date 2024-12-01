# Кэширование на фронтенде

## Кэширование запросов в роутере [graphql/api/public.ts](../src/graphql/api/public.ts)

### Как работает cache из @solidjs/router

```typescript
import { cache } from '@solidjs/router'

// Кэширование запроса с ключом
export const loadTopics = () =>
  cache(async () => {
    const resp = await defaultClient.query(loadTopicsQuery, {}).toPromise()
    return resp?.data?.get_topics_all as Topic[]
  }, 'topics')

// Кэширование с динамическим ключом
export const loadShouts = (args: QueryLoad_Shouts_ByArgs) => {
  const { options } = args
  const page = `${options?.offset || 0}-${(options?.limit || 0) + (options?.offset || 0)}`
  const filter = new URLSearchParams(options?.filters as Record<string, string>)
  
  return cache(async () => {
    const resp = await defaultClient.query(loadShoutsByQuery, args).toPromise()
    return resp?.data?.load_shouts_by as Shout[]
  }, `shouts-${filter}-${page}`) // Уникальный ключ для каждой комбинации фильтров и страницы
}
```

### Стратегии кэширования запросов

1. **Простое кэширование**
- Используется для редко меняющихся данных
- Один ключ на все данные

```typescript
// Список всех топиков
cache(fetchTopics, 'topics')
```

2. **Кэширование с параметрами**
- Для данных с фильтрацией/пагинацией
- Ключ включает все параметры

```typescript
// Поиск с пагинацией
const page = `${offset}-${limit}`
cache(fetchSearch, `search-${query}-${page}`)
```

3. **Кэширование для авторизованных запросов**
- Отдельный кэш для каждого клиента
- Учитывает авторизацию

```typescript
// Реакции пользователя
const kind = options.by.kinds.join('-')
cache(fetchReactions, `reactions-${kind}-${userId}`)
```

### Структура ключей кэша

| Тип данных | Формат ключа | Пример |
|------------|--------------|---------|
| Топики | `topics` | `topics` |
| Статьи | `shouts-${filter}-${page}` | `shouts-topic=tech&author=john-0-10` |
| Авторы | `author-${slug}` | `author-john-doe` |
| Поиск | `search-${text}-${page}` | `search-javascript-0-20` |
| Реакции | `${type}-${kind}-${filter}-${page}` | `shout-comment-likes-0-10` |

### Инвалидация кэша

1. **Автоматическая**
- При переходе между роутами
- При изменении параметров запроса

2. **Ручная**
- При обновлении данных
- При выходе пользователя

```typescript
// Очистка всего кэша
router.cache.clear()

// Очистка по маске
router.cache.delete((key) => key.startsWith('shouts-'))
```

### Оптимизации

1. **Предзагрузка данных**

```typescript
// В родительском роуте
export const load = () => {
  // Загружаем и кэшируем базовые данные
  loadTopics()
  loadAuthors({ limit: 10 })
}
```

2. **Переиспользование закэшированных данных**

```typescript
// Используем существующие данные пока загружаются новые
const data = cache(
  async () => {
    if (existingData) {
      // Возвращаем существующие данные немедленно
      return existingData
    }
    // Загружаем новые данные в фоне
    return await fetchNewData()
  },
  'cache-key'
)
```

3. **Гранулярные ключи**

```typescript
// Разделяем кэш для разных частей данных
const authorData = cache(
  () => fetchAuthorProfile(slug),
  `author-profile-${slug}`
)
const authorPosts = cache(
  () => fetchAuthorPosts(slug),
  `author-posts-${slug}`
)
```

### Типичные проблемы

1. **Слишком общие ключи**

```typescript
// ❌ Плохо - все запросы в одном кэше
cache(fetchData, 'data')

// ✅ Хорошо - разделяем по типу данных и параметрам
cache(fetchData, `${type}-${id}-${page}`)
```

2. **Неправильная инвалидация**

```typescript
// ❌ Плохо - очищаем весь кэш
router.cache.clear()

// ✅ Хорошо - очищаем только нужные данные
router.cache.delete((key) => key.startsWith(`${type}-`))
```

3. **Избыточное кэширование**

```typescript
// ❌ Плохо - кэшируем часто меняющиеся данные
cache(fetchRealTimeData, 'realtime')

// ✅ Хорошо - не кэшируем или используем короткое TTL
fetchRealTimeData()
``` 