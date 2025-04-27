# Счётчик просмотров

## Текущая реализация

### Основные компоненты
- `loadGAScript` - Асинхронная загрузка скрипта GA
- `initGA` - Инициализация GA с dataLayer
- `seen` - Сигнал с записями о просмотренных материалах в FeedProvider

### Процесс инициализации GA [ga.ts](../src/utils/ga.ts)
```typescript
// Загрузка скрипта
export const loadGAScript = (id: string) => {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById('ga-script')) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.id = 'ga-script'
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Analytics'))
    document.head.appendChild(script)
  })
}

// Инициализация
export const initGA = (id: string) => {
  const w = window as Window
  if (w) {
    w.dataLayer = w.dataLayer || []
    function gtag(...args: any[]) {
      w.dataLayer.push(args)
    }
    gtag('js', new Date())
    gtag('config', id)
  }
}
```

### Процесс учета просмотров

1. При монтировании страницы:
```typescript
// В FeedProvider
const [seen, setSeen] = createSignal<Record<string, number>>({})

// При загрузке страницы
onMount(async () => {
  await loadGAScript(GA_ID)
  initGA(GA_ID)
})
```

2. При просмотре материала:
```typescript
const addSeen = (slug: string) => {
  setSeen(prev => ({ 
    ...prev, 
    [slug]: Date.now() 
  }))
  
  // Отправляем событие в GA
  gtag('event', 'view_item', {
    item_id: slug,
    timestamp: Date.now()
  })
}
```

### Оптимизации

1. Загрузка скрипта:
- Асинхронная загрузка через async
- Проверка на существующий скрипт
- Обработка ошибок загрузки

2. Отправка событий:
- Дедупликация через seen состояние
- Временные метки для каждого просмотра
- Батчинг через dataLayer

### Метрики качества
- Успешность загрузки GA скрипта
- Процент отправленных событий
- Задержка между просмотром и отправкой события

## Требуемая реализация

### Основные компоненты
- `seen` - Сигнал в FeedProvider для хранения просмотров
- `addSeen` - Метод для отметки просмотра
- `getViewedStatus` - Проверка статуса просмотра

### Процесс учета просмотров

1. При монтировании компонента:
```typescript
// В ArticleCard
onMount(() => {
  // Отмечаем просмотр при монтировании
  addSeen(article.slug, {
    type: article.layout,
    author: article.created_by.slug,
    topic: article.main_topic?.slug
  })
})
```

2. Расширенное событие просмотра:
```typescript
interface ViewEvent {
  item_id: string          // slug материала
  item_type: string        // тип контента
  author_id: string        // автор
  topic_id?: string        // основная тема
}

const addSeen = (slug: string, params: Partial<ViewEvent>) => {
  setSeen(prev => ({
    ...prev,
    [slug]: {
      timestamp: Date.now(),
      ...params
    }
  }))

  gtag('event', 'view_item', {
    ...params,
    item_id: slug,
    timestamp: Date.now()
  })
}
```

3. Проверка статуса просмотра:
```typescript
// В компонентах
const isViewed = (slug: string) => {
  return Boolean(seen()[slug])
}
```

### Дополнительные метрики

1. Для статей:
- Факт просмотра
- Взаимодействия (комментарии, реакции)

2. Для медиа:
- Факт просмотра
- Действия с плеером

### Оптимизации

1. Производительность:
- Простое состояние в FeedProvider
- Минимум вычислений
- Только необходимые события

2. Точность:
- Учет только реальных просмотров
- Фильтрация ботов и краулеров
- Дедупликация по сессии

### Интеграция с аналитикой

1. События GA:
- view_item - базовый просмотр
- view_item_list - просмотр списка
- scroll - метрики скролла
- engagement - метрики вовлеченности

2. Пользовательские метрики:
- Среднее время на материале
- Глубина просмотра контента
- Процент повторных просмотров
