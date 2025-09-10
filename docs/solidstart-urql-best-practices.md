# 🚀 SolidStart + URQL Best Practices

## 🎯 Архитектура кеширования

### Проблема localStorage переполнения
❌ **Неправильно**: Безлимитное кеширование в localStorage
```typescript
// Ведет к QuotaExceededError
sessionStorage.setItem(cacheKey, hugeGraphQLResponse)
```

✅ **Правильно**: Многоуровневая стратегия кеширования

## 🏗️ Рекомендуемая архитектура

### 1. URQL Document Cache (Основа)
```typescript
import { cacheExchange, createClient, ssrExchange } from '@urql/core'

const client = createClient({
  url: '/graphql',
  exchanges: [
    cacheExchange, // 🎯 Основной кеш URQL в памяти
    ssrExchange({ isClient: !isServer }),
    fetchExchange
  ],
  requestPolicy: 'cache-and-network' // 🚀 Оптимальная стратегия
})
```

### 2. Request Policies по типу данных

```typescript
// ✅ Статичные данные (авторы, топики)
requestPolicy: 'cache-first' 

// ✅ Динамичные данные (ленты, комментарии) 
requestPolicy: 'cache-and-network'

// ✅ Персональные данные (профиль, приватные)
requestPolicy: 'network-only'

// ✅ SSR всегда
requestPolicy: 'network-only'
```

### 3. Умное localStorage кеширование

```typescript
interface SmartCacheConfig {
  maxSize: number // Лимит записей
  maxAge: number  // TTL в миллисекундах  
  priority: 'lru' | 'size' | 'frequency'
}

class SmartCache {
  private config: SmartCacheConfig
  private stats = new Map<string, { hits: number, lastAccess: number, size: number }>()
  
  set(key: string, data: any, priority = 1) {
    // 1. Проверяем квоту localStorage
    if (this.getStorageUsage() > 0.8) {
      this.cleanup()
    }
    
    // 2. Сжимаем данные если > 100KB
    const compressed = this.shouldCompress(data) 
      ? LZString.compress(JSON.stringify(data))
      : JSON.stringify(data)
    
    // 3. Сохраняем с метаданными
    localStorage.setItem(key, JSON.stringify({
      data: compressed,
      timestamp: Date.now(),
      priority,
      compressed: this.shouldCompress(data)
    }))
  }
  
  private cleanup() {
    // LRU cleanup по статистике использования
    const entries = Array.from(this.stats.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
    
    // Удаляем 30% старых записей
    const toRemove = entries.slice(0, Math.floor(entries.length * 0.3))
    toRemove.forEach(([key]) => {
      localStorage.removeItem(key)
      this.stats.delete(key)
    })
  }
}
```

### 4. Гибридный подход для SolidStart

```typescript
export function createSmartLoader<T, Args>(
  query: DocumentNode,
  getVariables: (args: Args) => Record<string, unknown>,
  config: {
    cacheLevel: 'memory' | 'session' | 'persistent' | 'none'
    ttl?: number
    maxSize?: number
  }
) {
  return (args: Args) => async (): Promise<T> => {
    const variables = getVariables(args)
    
    switch (config.cacheLevel) {
      case 'memory':
        // Используем только URQL Document Cache
        return client.query(query, variables, { requestPolicy: 'cache-first' }).toPromise()
        
      case 'session':
        // Умное sessionStorage кеширование
        return smartCache.getOrSet(
          `session-${hash(query, variables)}`,
          () => client.query(query, variables).toPromise(),
          { ttl: config.ttl || 30 * 60 * 1000 } // 30 мин
        )
        
      case 'persistent':
        // localStorage с LRU cleanup
        return smartCache.getOrSet(
          `persist-${hash(query, variables)}`,
          () => client.query(query, variables).toPromise(),
          { ttl: config.ttl || 24 * 60 * 60 * 1000 } // 24 часа
        )
        
      case 'none':
        // Без кеширования
        return client.query(query, variables, { requestPolicy: 'network-only' }).toPromise()
    }
  }
}
```

### 5. Конфигурация по типу запросов

```typescript
// ✅ Статичные справочники (топики, авторы)
const loadTopics = createSmartLoader(LoadTopicsQuery, args => args, {
  cacheLevel: 'persistent',
  ttl: 24 * 60 * 60 * 1000, // 24 часа
  maxSize: 1000 // 1000 записей
})

// ✅ Контент (статьи, комментарии)  
const loadShouts = createSmartLoader(LoadShoutsQuery, args => args, {
  cacheLevel: 'session',
  ttl: 10 * 60 * 1000, // 10 минут
  maxSize: 500
})

// ✅ Персональные данные
const loadPrivateData = createSmartLoader(LoadPrivateQuery, args => args, {
  cacheLevel: 'memory', // Только URQL cache
  ttl: 5 * 60 * 1000    // 5 минут
})

// ✅ Реал-тайм данные
const loadNotifications = createSmartLoader(LoadNotificationsQuery, args => args, {
  cacheLevel: 'none' // Всегда свежие
})
```

## 🔧 SolidStart специфика

### 1. SSR + Hydration
```typescript
// ✅ Правильная гидрация URQL
const ssr = ssrExchange({
  isClient: !isServer,
  initialState: !isServer ? window.__URQL_DATA__ : undefined
})

// ✅ Разные policies для SSR/Client
const client = createClient({
  exchanges: [cacheExchange, ssr, fetchExchange],
  requestPolicy: isServer ? 'network-only' : 'cache-and-network'
})
```

### 2. route.load только для SSR
```typescript
// ✅ route.load ТОЛЬКО для первичной загрузки SSR
export const route = {
  load: async ({ params }) => {
    // Выполняется ТОЛЬКО при SSR
    return await loadTopicData(params.slug)
  }
}

// ✅ Клиентские переходы через createResource
export default function TopicPage(props) {
  const params = useParams()
  
  const [data] = createResource(
    () => ({ slug: params.slug, ssrData: props.data }),
    async ({ slug, ssrData }) => {
      // При изменении slug - загружаем новые данные
      if (slug && slug !== previousSlug) {
        return await loadTopicData(slug)
      }
      // SSR данные для первого рендера
      return ssrData instanceof Promise ? await ssrData : ssrData
    }
  )
}
```

### 3. Предотвращение QuotaExceededError

```typescript
// ✅ Мониторинг квоты localStorage
function getStorageQuota(): number {
  let total = 0
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length
    }
  }
  return total / (1024 * 1024) // MB
}

// ✅ Автоочистка при достижении лимита
function ensureStorageSpace(requiredMB: number) {
  const currentUsage = getStorageQuota()
  const maxQuota = 10 // 10MB лимит для большинства браузеров
  
  if (currentUsage + requiredMB > maxQuota * 0.8) {
    // Очищаем 30% самых старых записей
    clearOldestCacheEntries(0.3)
  }
}
```

## 📋 Чеклист внедрения

- [ ] Заменить `createCacheableLoader(query, vars, true)` на `createSmartLoader`
- [ ] Настроить приоритеты кеширования по типу данных
- [ ] Добавить мониторинг localStorage quota
- [ ] Реализовать LRU cleanup
- [ ] Протестировать гидрацию SSR
- [ ] Настроить сжатие для больших ответов
- [ ] Добавить метрики производительности кеша

## 🚨 Антипаттерны

❌ **НЕ делать**:
```typescript
// Безлимитное кеширование
sessionStorage.setItem(key, JSON.stringify(hugeData))

// Кеширование персональных данных в localStorage
localStorage.setItem('user-profile', JSON.stringify(profile))

// Одинаковая cache policy для всех запросов
requestPolicy: 'cache-and-network' // для всего

// Игнорирование QuotaExceededError
try {
  localStorage.setItem(key, data)
} catch (e) {
  // Молча игнорируем ошибку
}
```

✅ **Правильно**:
```typescript
// Умное кеширование с лимитами
smartCache.set(key, data, { priority: 'high', ttl: 3600000 })

// Персональные данные только в памяти
memoryCache.set(key, profile, { ttl: 300000 })

// Разные policies по типу данных
const policy = getRequestPolicy(queryType, isPersonal, isRealtime)

// Graceful handling переполнения
try {
  localStorage.setItem(key, data)
} catch (e) {
  if (e.name === 'QuotaExceededError') {
    await cleanupCache()
    localStorage.setItem(key, data) // Повторная попытка
  }
}
```

## 🎯 Результат
- 🚀 Нет переполнения localStorage
- ⚡ Оптимальная производительность
- 🛡️ Стабильная гидрация SSR
- 📊 Контролируемое использование памяти
