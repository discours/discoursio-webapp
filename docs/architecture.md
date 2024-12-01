# Архитектура Discours

## Структура контекстов данных
```
SessionProvider (auth, client)
└── LocalizeProvider (i18n)
    └── TopicsProvider (topics, filters)
        └── FeaturedFeedProvider (featured articles)
            └── FeedProvider (main content)
                └── UIProvider (modals, snackbars)
                    └── EditorProvider (TipTap)
                        └── AuthorsProvider (profiles)
                            └── FollowingProvider (subscriptions)
```

## Потоки данных

### Лента публикаций
```
FeedProvider
├── Recent ──> sortByDate()
├── Hot ────> sortByViews()
├── Top ────> sortByRating()
└── Search ─> filterByQuery()
```

### Реакции и комментарии
```
ReactionsProvider
├── reactionEntities ──> Record<id, Reaction>
├── reactionsByShout ─> Record<shoutId, Reaction[]> 
├── commentsByAuthor ─> Record<authorId, Reaction[]>
└── addShoutReactions() ─> обновляет все 3 стора
```

### Редактор
```
EditorProvider
├── TipTap Core
│   ├── Base Extensions
│   └── Custom Extensions
├── Collaboration
│   ├── Y.js
│   └── WebSocket
└── Media Upload
    └── Обработка изображений
```

## Особенности реализации

### Оптимизации
- Мемоизация тяжелых вычислений через createMemo
- Батчинг обновлений состояния
- Ленивая загрузка компонентов
- Дедупликация данных в сторах

### Кэширование
- Кэширование GraphQL запросов
- Локальное хранение состояния в IndexedDB
- Предзагрузка данных для роутов

### Интернационализация
- Динамическая загрузка переводов
- Форматирование дат и чисел
- Обработка множественных форм

### Безопасность
- CSRF токены
- Санитизация HTML
- Проверка прав доступа
- Защита от XSS

## Ключевые технические решения

1. **Изоляция состояния**
   - Каждый провайдер отвечает за свою область
   - Минимизация пересечений между провайдерами
   - Четкие границы ответственности

2. **Оптимистичные обновления**
   - Мгновенное обновление UI
   - Фоновая синхронизация с сервером
   - Откат при ошибках

3. **Реактивность**
   - Сигналы для локального состояния
   - Эффекты для синхронизации
   - Мемо для вычисляемых значений

4. **Модульность**
   - Переиспользуемые компоненты
   - Инъекция зависимостей через контекст
   - Слабая связанность модулей 