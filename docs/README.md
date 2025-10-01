# 📚 Документация Discours.io

## 🎯 Обзор

**Discours.io** — платформа для публикации и обсуждения контента о культуре, науке и обществе. Веб-приложение построено на современных технологиях с акцентом на производительность и пользовательский опыт.

**Технологии:** SolidJS + TypeScript + GraphQL + SCSS + Lightning CSS

## 📋 Структура документации

### 🏗️ [Архитектура](architecture/)
- **[Обзор](./architecture/overview.md)** — Система и технологии
- **[Структура](./architecture/structure.md)** — Организация кода
- **[GraphQL Codegen плагины](./architecture/graphql-codegen-plugins.md)** — Конфигурация генерации
### ⚡ [Развертывание](deployment/)
-

### ⚡ [Разработка](development/)
- **[Рабочий процесс](./development/workflow.md)** — Процессы разработки
- **[Стандарты кода](./development/standards.md)** — Правила и соглашения
- **[Тестирование](./development/testing.md)** — Автоматизация качества
- **[Деплой](./development/deployment.md)** — Развертывание
- **[CI интеграция](./development/ci-integration.md)** — Автоматизированное тестирование
- **[Участие](./development/contributing.md)** — Руководство для контрибьюторов

### 🎨 [Функциональность](features/)
- **[Обзор](./features/overview.md)** — Основные возможности
- **[Аутентификация](./features/auth.md)** — Регистрация и OAuth
- **[Редактор](./features/editor.md)** — Создание контента
- **[Черновики](./features/drafts.md)** — Работа с черновиками
- **[Лента](./features/feed-components.md)** — Персонализированный контент
- **[Комментарии](./features/branch-pagination.md)** — Система комментариев

### 🚀 [Быстрый старт](getting-started/)
- **[Установка](./getting-started/quick-start.md)** — Настройка проекта

### 🛠️ [Справочники](reference/)
- **[Команды](./reference/commands.md)** — NPM скрипты
- **[Конфигурация](./reference/configuration.md)** — Переменные окружения
- **[Изображения](./reference/images.md)** — Оптимизация и кеширование
- **[Аналитика](./reference/analytics.md)** — Метрики и мониторинг
- **[Безопасность](./reference/security.md)** — Рекомендации

### 🧪 [Тестирование](testing/)
- **[Сценарии](./testing/test-use-cases.md)** — Тестовые кейсы
- **[Автоматизация](./testing/testing.md)** — E2E и интеграционные тесты

## 🚀 Быстрый старт

### Установка
```bash
git clone https://github.com/discours/discoursio-webapp.git
cd discoursio-webapp
npm install
```

### Разработка
```bash
npm run dev      # Запуск сервера разработки
npm run build    # Сборка для продакшена
npm run typecheck # Проверка типов
npm run fix      # Автоисправление кода
```

### Тестирование
```bash
npm run e2e:tests  # E2E тесты
npm run test:coverage # Покрытие кода
```

## 📊 Статус проекта

**Версия:** v0.14.25
**Статус:** Активная разработка

## 🤝 Участие

Изучите [руководство по участию](development/contributing.md) перед отправкой изменений.

## 📚 Полезные ресурсы

- [SolidJS Docs](https://www.solidjs.com/docs)
- [GraphQL Guide](https://graphql.org/learn/)
- [Vite Docs](https://vitejs.dev/)
- [Biome Linter](https://biomejs.dev/)
- [Lightning CSS](https://lightningcss.dev/)

---

*Документация обновляется автоматически с развитием проекта*