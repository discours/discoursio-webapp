# Документация проекта

## Основные документы

- [README проекта](../README.md) - Основная информация о проекте
- [CHANGELOG](../CHANGELOG.md) - История изменений
- [Lightning CSS Integration](lightning-css-integration.md) - Подробное руководство по интеграции Lightning CSS
- [NPM Scripts](npm-scripts.md) - Документация по npm командам проекта
- [Архитектура](architecture.md) - Техническая архитектура проекта

## Разработка

- [Git Workflow](git-workflow.md) - Правила работы с Git
- [Code Style](code-style.md) - Стандарты кодирования
- [Testing](testing.md) - Стратегия тестирования
- [Deployment](deployment.md) - Процесс деплоя

## API

- [GraphQL Schema](../src/graphql/schema/) - Схемы GraphQL
- [API Documentation](api.md) - REST API документация

## Компоненты

- [UI Components](components.md) - Библиотека компонентов
- [Styling Guide](styling.md) - Руководство по стилизации
- [Icons](../src/components/_shared/Icon/icons/) - Иконки проекта
- [Система кеширования изображений](image-caching.md) - Полное руководство по кешированию изображений

# Документация  фронтенда discours.io

Проект использует: SolidJS, Typescript, GraphQL, SASS

- [Функциональные возможности](features.md)
- [Аналитика и метрики](analytics.md)
- Как работает [счётчик просмотров](views-counter.md)
- [Кеширование загружаемых данных](caching.md)
- [Система кеширования изображений](image-caching.md) - Многоуровневое кеширование, обработка ошибок, заглушки
- [Легковесный нативный редактор](../src/components/SimpleRichEditor/README.md)
- [Система аутентификации](auth.md)

## Ленты

- [Общие механики лент](feed-components.md)
- [Фильтрация и сортировка](feed-components.md#фильтрация-и-сортировка)
- [Работа с `FeedProvider`](feed-components.md#работа-с-feedprovider)
- [Работа с `FeedSwitcher` и `FeedFilter`](feed-components.md#работа-с-feedswitcher-и-feedfilter)
- [Оптимизация SSR](feed-components.md#оптимизация-ssr)
- [Управление состояниями](feed-components.md#управление-состояниями)

## SEO и социальные сети

- [Open Graph теги](open-graph.md)
- [Генерация динамических OG-изображений](open-graph.md#генерация-динамических-og-изображений)
- [Оптимизация мета-тегов](open-graph.md#оптимизация-мета-тегов)
- [Twitter Cards](open-graph.md#twitter-cards)

## Комментарии

- [Фильтры комментариев](comments-filter.md)
- [Фильтрация и сортировка](comments-filter.md#фильтрация-и-сортировка)
- [Управление состоянием](comments-filter.md#управление-состоянием)

## Статьи про SolidJS

- Как работают [асинхронные наблюдатели](solid-async.md)
- [Кешируемое состояние компонентов](solid-memo.md)
- [Паттерны загрузки данных](api-patterns.md)
- [Борьба с циклическими эффектами](solid-effects.md)

## Статьи про процесс разработки

- [Как проходит ревью PR](pr-review.md)
- [Порядок ревью запросов на добавление PR](pr-review.md#порядок-ревью-запросов-на-добавление-pr)
- [Условия принятия PR](pr-review.md#условия-принятия-pr)

## Компоненты
- [Работа с топиками](./topics.md)
- [Облако тегов для выбора тем](./topic-pills-cloud.md)
- [Система черновиков и публикации](./drafts.md)

## Авторизация и безопасность
- [OAuth Implementation Guide](./oauth-implementation.md) - Полное руководство по реализации OAuth
- [OAuth Deployment Checklist](./oauth-deployment.md) - Чеклист для развертывания OAuth

## Архитектура
- [SolidJS Fine-grained Reactivity](./solid-memo.md) - Принципы реактивности
- [State Management](./state-management.md) - Управление состоянием приложения

## Тестирование  
- [E2E Testing OAuth](../tests/oauth.spec.ts) - Автоматические тесты OAuth
- [Component Testing](./testing.md) - Тестирование компонентов

## API и интеграции
- [GraphQL Schema](../src/graphql/schema/) - Схема GraphQL API
- [Context Providers](../src/context/) - Контекстные провайдеры

## Компоненты
- [UI Components](../src/components/) - Переиспользуемые компоненты
- [Form Components](../src/components/AuthModal/) - Компоненты форм

# Документация discoursio-webapp

Техническая документация для проекта discoursio-webapp на SolidJS.

## 📚 Содержание

### Основная документация
- [README.md](../README.md) - Основная информация о проекте
- [README.en.md](../README.en.md) - Project documentation in English
- [features.md](features.md) - Описание функциональности проекта

### Техническая документация
- [Service Worker](service-worker.md) - Offline-функциональность и кэширование
- [Lightning CSS Integration](lightning-css-integration.md) - CSS оптимизация
- [Solid Signals 2.0](solid-signals-20.md) - Будущее реактивности

### Архитектура и интеграции
- Система кэширования и PWA возможности
- GraphQL с URQL клиентом
- i18next интернационализация
- SolidJS реактивность
- Vite + Vinxi сборка
- [Open Graph и социальные сети](open-graph.md) - Динамические OG-изображения и мета-теги

## 🚀 Быстрый старт

1. **Установка зависимостей**
   ```bash
   bun install
   ```

2. **Настройка окружения**
   ```bash
   cp .env.example .env
   # Отредактируйте .env файл
   ```

3. **Запуск разработки**
   ```bash
   bun run dev
   ```

4. **Сборка для продакшена**
   ```bash
   bun run build
   ```

## 📱 PWA возможности

Приложение поддерживает **Progressive Web App** функциональность:

- **Service Worker** - автоматическое кэширование и offline-режим
- **Responsive Design** - адаптивный дизайн для всех устройств  
- **Push Notifications** - уведомления от сервера
- **Background Sync** - синхронизация данных в фоне

Подробнее в [Service Worker документации](service-worker.md).

## 🛠 Разработка

### Структура проекта
```
src/
├── components/     # Компоненты UI
├── graphql/       # GraphQL схемы и запросы
├── routes/        # Роутинг приложения
├── context/       # Контексты и провайдеры
├── utils/         # Утилиты и хелперы
└── styles/        # Глобальные стили

public/
├── sw.js          # Service Worker
├── offline.html   # Offline страница
└── icons/         # Иконки приложения
```

### Основные команды
- `bun run dev` - разработка
- `bun run build` - сборка
- `bun run lint` - проверка кода
- `bun run typecheck` - проверка типов
- `bun run e2e` - E2E тесты

### Полезные ресурсы
- [SolidJS Docs](https://www.solidjs.com/docs)
- [SolidStart Guide](https://start.solidjs.com/)
- [URQL Documentation](https://formidable.com/open-source/urql/)
- [Vite Guide](https://vitejs.dev/guide/)

## 🔧 Настройки

### Переменные окружения
```bash
# API настройки
PUBLIC_GRAPHQL_ENDPOINT=...
PUBLIC_API_URL=...

# Конфигурация сборки
NODE_ENV=development
```

### Service Worker
Service Worker автоматически регистрируется и обеспечивает:
- Кэширование статических ресурсов
- Offline-функциональность
- Push-уведомления
- Фоновую синхронизацию

## 📖 Дополнительная информация

Для получения более подробной информации о конкретных аспектах проекта, обращайтесь к соответствующим разделам документации выше.