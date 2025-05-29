# Отладка клиентских ошибок

## Система диагностики

Проект содержит комплексную систему отладки клиентских ошибок, расположенную в `~/utils/debug.ts`.

## Глобальная обработка ошибок

### entry-client.tsx

Все JavaScript ошибки автоматически перехватываются и логируются с детальной информацией:

```typescript
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler] Uncaught error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack
  })
})
```

### Обработка промисов

```typescript
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Promise Rejection] Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise
  })
})
```

## Инструменты отладки

### createComponentDebugger

Создает отладочную обертку для компонента:

```typescript
import { createComponentDebugger } from '~/utils/debug'

const componentDebugger = createComponentDebugger('MyComponent')

// Логирование состояния
componentDebugger.logState({ user: userData })

// Логирование ошибок с контекстом
componentDebugger.logError(error, 'user interaction')
```

### checkNullSafety

Проверяет доступность вложенных свойств:

```typescript
import { checkNullSafety } from '~/utils/debug'

if (!checkNullSafety(session, 'author.slug')) {
  // Безопасная обработка отсутствующих данных
  return null
}
```

### safeGet

Безопасное извлечение значений с логированием:

```typescript
import { safeGet } from '~/utils/debug'

const authorSlug = safeGet(session, 'author.slug', 'default-slug')
```

## Диагностика ошибки ProfilePopup

### Симптомы
- "Uncaught Client Exception" при клике на userpic
- Ошибка "Cannot read properties of undefined (reading 'slug')"

### Причина
Компонент `ProfilePopup` пытался получить доступ к `author().slug` до завершения загрузки сессии.

### Решение
1. **Null-безопасность**: Добавлена проверка `author() || null`
2. **ErrorBoundary**: Обернули компонент в ErrorBoundary
3. **Условный рендеринг**: Используем `Show` компонент
4. **Диагностика**: Интегрирована система отладки

### Пример исправления

```tsx
// До
const author = createMemo<Author>(() => session()?.author as Author)

// После  
const author = createMemo<Author | null>(() => {
  const currentSession = session()
  
  if (!checkNullSafety(currentSession, 'author.slug')) {
    return null
  }
  
  return currentSession?.author || null
})

return (
  <Show when={author()} fallback={null}>
    {(currentAuthor) => (
      <ProfileMenu author={currentAuthor()} />
    )}
  </Show>
)
```

## Отладка в development режиме

### Консольное логирование

В development режиме система автоматически логирует:

- Состояние компонентов
- Изменения сессии
- Ошибки с полным контекстом
- Время выполнения операций

### Алерты ошибок

В development режиме критические ошибки показываются в алертах для немедленного внимания разработчика.

## Мониторинг производительности

```typescript
import { withPerformanceMonitoring } from '~/utils/debug'

const optimizedFunction = withPerformanceMonitoring(
  myExpensiveFunction,
  'MyExpensiveOperation'
)
```

## Рекомендации

1. **Всегда используйте null-checks** для данных сессии
2. **Оборачивайте критические компоненты** в ErrorBoundary
3. **Используйте createComponentDebugger** для новых компонентов
4. **Проверяйте консоль** в development режиме
5. **Используйте safeGet** для глубоко вложенных свойств

## Известные проблемы

### ProfilePopup
- **Решено**: Null reference при отсутствии сессии
- **Статус**: Исправлено в версии [Unreleased]

### Типизация Author
- **Решено**: Принудительное приведение типов `as Author`
- **Статус**: Заменено на безопасную типизацию 