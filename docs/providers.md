# Провайдеры Discours

## Основные провайдеры

### SessionProvider
- Авторизация через Authorizer.dev
- Обновление токена каждые 30 минут
- Синхронизация сессии между вкладками

### LocalizeProvider
- Русский/Английский языки
- Форматирование дат через TimeAgo
- Множественные формы для комментариев

### FeedProvider
- Кэширование лент в IndexedDB
- Оптимистичные обновления
- Дедупликация статей
- Режимы сортировки:
  ```typescript
  const currentFeed = createMemo(() => {
    switch (mode()) {
      case 'hot': return hotFeed()
      case 'top': return topFeed()
      case 'followed': return followedFeed()
      case 'discussed': return discussedFeed()
      // ...
    }
  })
  ```

## Специализированные провайдеры

### ReactionsProvider
- Лайки/дизлайки
- Комментарии
- Оптимистичные обновления

### EditorProvider
- Интеграция с TipTap
- Коллаборация через Y.js
- Автосохранение в IndexedDB

### UIProvider
- Модальные окна
- Снэкбары
- Управление скроллом

### FeaturedFeedProvider
- Управление избранным контентом
- Мемоизированные выборки:
  ```typescript
  const topViewedFeed = createMemo(() =>
    [...featuredFeed()].sort(byStat('viewed'))
  )
  const topCommentedFeed = createMemo(() =>
    [...featuredFeed()].sort(byStat('commented'))
  )
  ```
- Синхронизация с основной лентой