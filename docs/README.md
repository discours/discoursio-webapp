# Документация проекта

## Основные документы

- [README проекта](../README.md) - Основная информация о проекте
- [CHANGELOG](../CHANGELOG.md) - История изменений
- [Lightning CSS Integration](lightning-css-integration.md) - Интеграция Lightning CSS toolchain
- [NPM Scripts](npm-scripts.md) - Документация по командам разработки
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

# Документация  фронтенда discours.io

Проект использует: SolidJS, Typescript, GraphQL, SASS

- [Функциональные возможности](features.md)
- [Аналитика и метрики](analytics.md)
- Как работает [счётчик просмотров](views-counter.md)
- [Кеширование загружаемых данных](caching.md)
- [Легковесный нативный редактор](../src/components/SimpleRichEditor/README.md)
- [Система аутентификации](auth.md)

## Ленты

- [Общие механики лент](feed-components.md)
- [Фильтрация и сортировка](feed-components.md#фильтрация-и-сортировка)
- [Работа с `FeedProvider`](feed-components.md#работа-с-feedprovider)
- [Работа с `FeedSwitcher` и `FeedFilter`](feed-components.md#работа-с-feedswitcher-и-feedfilter)
- [Оптимизация SSR](feed-components.md#оптимизация-ssr)
- [Управление состояниями](feed-components.md#управление-состояниями)

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