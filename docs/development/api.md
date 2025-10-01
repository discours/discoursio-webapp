# 🔗 API интеграция

## 🎯 GraphQL архитектура

Приложение использует GraphQL для типобезопасного взаимодействия с бэкендом.

### 🛠️ Основные компоненты

| Компонент | Назначение | Реализация |
|-----------|------------|------------|
| **URQL клиент** | GraphQL запросы | Создание и настройка клиента |
| **Exchanges** | Перехватчики запросов | Кеширование, SSR, авторизация |
| **Генераторы типов** | TypeScript типизация | Автоматическая генерация |
| **Кастомные exchanges** | Специфичная логика | Кеширование, retry, logging |

## 🔧 Настройка клиента

### Базовая конфигурация
```typescript
import { createClient, cacheExchange, ssrExchange, fetchExchange } from '@urql/core'

const client = createClient({
  url: 'https://v3.dscrs.site/graphql',
  exchanges: [
    cacheExchange,
    ssrExchange({ isClient: !isServer }),
    fetchExchange
  ],
  requestPolicy: 'cache-and-network'
})
```

### Кастомные exchanges
```typescript
// Retry exchange для обработки ошибок сети
const retryExchange = retryExchange({
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  randomDelay: true,
  maxNumberAttempts: 3
})

// Авторизационный exchange
const authExchange = authExchange(async (utils) => {
  const token = getToken()
  return {
    token,
    type: 'Bearer'
  }
})
```

## 📊 Стратегии кеширования

### Уровни кеширования
- **Document Cache** — память браузера (URQL)
- **Session Storage** — сессионное хранение
- **Local Storage** — постоянное хранение
- **CDN** — глобальное кеширование

### Политики запросов
```typescript
// Статичные данные (авторы, темы)
requestPolicy: 'cache-first'

// Динамичные данные (ленты, комментарии)
requestPolicy: 'cache-and-network'

// Персональные данные
requestPolicy: 'network-only'
```

## 🔄 SSR интеграция

### route.load для серверной загрузки
```typescript
export const route = {
  load: async ({ params }) => {
    const data = await client.query(GET_TOPIC, { slug: params.slug }).toPromise()
    return data.data
  }
} satisfies RouteDefinition
```

### Клиентская гидрация
```typescript
export default function TopicPage(props: RouteSectionProps) {
  const [data] = createResource(
    () => props.data,
    async (initialData) => {
      if (initialData) return initialData
      return await client.query(GET_TOPIC, { slug: params.slug }).toPromise()
    },
    { initialValue: props.data }
  )
}
```

## 📡 Real-time интеграция

### SSE соединение
```typescript
const eventSource = new ExtendedEventSource('/api/events', {
  headers: { Authorization: `Bearer ${token}` }
})

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // Обработка real-time событий
}
```


## 📈 Производительность

### Оптимизации запросов
- **Запросы пачками** — объединение мелких запросов
- **Дедупликация** — избежание повторных запросов
- **Отмена устаревших** — отмена ненужных запросов
- **Предзагрузка** — загрузка данных заранее

### Мониторинг
- **Query DevTools** — отладка GraphQL запросов
- **Performance метрики** — время выполнения запросов
- **Error tracking** — отслеживание неудачных запросов
