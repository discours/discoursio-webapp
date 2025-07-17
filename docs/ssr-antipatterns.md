# SSR Гидрация в Solid Start: Руководство по Решению Проблем

## Введение

Этот документ содержит comprehensive подход к обработке гидрации в Solid Start, включая антипаттерны, решения и стратегии диагностики.

## 1. Безопасная Работа с Контекстами

### Антипаттерн
```typescript
// ❌ Небезопасное использование контекста
const { randomTopicFeed } = useFeaturedFeed()

createEffect(() => {
  const value = randomTopicFeed()
  if (!value) {
    console.warn('Контекст не инициализирован')
  }
})
```

### Решение
```typescript
// ✅ Безопасный доступ к контексту
const safeRandomTopicFeed = createMemo(() => {
  try {
    const context = useFeaturedFeed()
    return context.randomTopicFeed() || []
  } catch {
    return []
  }
})
```

## 2. Небезопасное Использование Браузерных API

### Антипаттерн
```typescript
// ❌ Критическая ошибка
const UserProfile = () => {
  const [screenWidth, setScreenWidth] = createSignal(window.innerWidth)

  onMount(() => {
    window.addEventListener('resize', () => {
      setScreenWidth(window.innerWidth)
    })
  })

  return <div>Ширина: {screenWidth()}</div>
}
```

### Решение
```typescript
// ✅ Безопасная реализация
const UserProfile = () => {
  const [screenWidth, setScreenWidth] = createSignal(0)

  createEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => setScreenWidth(window.innerWidth)
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  })

  return <div>Ширина: {screenWidth()}</div>
}
```

## 3. Асинхронная Загрузка Данных

### Антипаттерн
```typescript
// ❌ Без обработки загрузки
const HomeView = () => {
  const [data] = createResource(fetchData)
  
  return <div>{data()}</div>
}
```

### Решение
```typescript
// ✅ С корректной обработкой загрузки
const HomeView = () => {
  const [data] = createResource(fetchData)
  
  return (
    <Suspense fallback={<Loader />}>
      <Show when={data()}>
        {(resolvedData) => <div>{resolvedData}</div>}
      </Show>
    </Suspense>
  )
}
```

## 4. Динамическая Генерация Идентификаторов

### Антипаттерн
```typescript
// ❌ Источник гидратационных ошибок
const CommentList = () => {
  const comments = [
    { id: Math.random(), text: 'Комментарий 1' },
    { id: Math.random(), text: 'Комментарий 2' }
  ]

  return (
    <ul>
      {comments.map(comment => (
        <li key={comment.id}>{comment.text}</li>
      ))}
    </ul>
  )
}
```

### Решение
```typescript
// ✅ Стабильная генерация ключей
const CommentList = () => {
  const comments = [
    { id: 'comment-1', text: 'Комментарий 1' },
    { id: 'comment-2', text: 'Комментарий 2' }
  ]

  return (
    <ul>
      {comments.map(comment => (
        <li data-comment-id={comment.id}>{comment.text}</li>
      ))}
    </ul>
  )
}
```

## 5. Прямые Манипуляции с DOM

### Антипаттерн
```typescript
// ❌ Небезопасное управление DOM
const CustomComponent = () => {
  let elementRef: HTMLDivElement

  onMount(() => {
    elementRef.style.opacity = '0.5'
    elementRef.addEventListener('click', handleClick)
  })

  return <div ref={elementRef}>Контент</div>
}
```

### Решение
```typescript
// ✅ Реактивное управление
const CustomComponent = () => {
  const [isActive, setIsActive] = createSignal(false)

  return (
    <div 
      style={{ opacity: isActive() ? 0.5 : 1 }}
      onClick={() => setIsActive(!isActive())}
    >
      Контент
    </div>
  )
}
```

## Ключевые Стратегии Диагностики и Решения

1. **Проверка Наличия Браузерных API**
   - Всегда используйте `typeof window !== 'undefined'`
   - Применяйте условный рендеринг

2. **Безопасные Эффекты**
   ```typescript
   createEffect(() => {
     if (typeof window !== 'undefined') {
       // Безопасный код
     }
   })
   ```

3. **Использование Встроенных Компонентов**
   - `<Suspense>` для асинхронных данных
   - `<Show>` для условного рендеринга
   - `<ErrorBoundary>` для перехвата ошибок

4. **Диагностика Гидрации**
   ```typescript
   // Утилита для сравнения DOM
   compareServerClientDOM()
   ```

## Источники и Дополнительное Чтение

- [Solid.js Docs: Hydration](https://www.solidjs.com/docs/server/hydration)
- [Solid.js Rendering Docs](https://www.solidjs.com/docs/server/rendering)

## Заключение

Следуя этим рекомендациям, вы значительно улучшите стабильность и предсказуемость SSR-рендеринга в вашем Solid Start приложении.