# 🚀 Быстрый старт

## 📋 Предварительные требования

- **Node.js** 20+ или **npm** 1.0+
- **Git** для управления версиями
- **IDE** с поддержкой TypeScript (VS Code, Cursor, etc.)

## ⚡ Установка проекта

### 1. Клонирование репозитория
```bash
git clone https://github.com/discoursio/discoursio-webapp.git
cd discoursio-webapp
```

### 2. Установка зависимостей
```bash
# Через npm (рекомендуется)
npm install

# Или через npm
npm install
```

### 3. Настройка окружения
```bash
# Создать файл окружения
cp .env.example .env

# Отредактировать переменные
nano .env
```

**Обязательные переменные:**
```bash
# GraphQL API
PUBLIC_CORE_API=https://v3.dscrs.site/graphql

# CDN для изображений
PUBLIC_CDN_URL=https://files.dscrs.site

# Inbox API (для чатов)
PUBLIC_INBOX_API=https://inbox.dscrs.site

# Real-time события
PUBLIC_REALTIME_EVENTS=https://connect.dscrs.site
```

## 🏃‍♂️ Запуск разработки

### Режим разработки
```bash
# Запуск dev сервера
npm run dev

# Или через npm
npm run dev
```

**Что происходит:**
- ⚡ Vite запускает dev сервер на `http://localhost:3000`
- 🔄 Hot Module Replacement для мгновенных обновлений
- 📊 Автоматическая проверка типов TypeScript
- 🎨 Lightning CSS обработка стилей

### Сборка для продакшена
```bash
# Сборка оптимизированного бандла
npm run build

# Запуск production сервера
npm run start
```

## 🛠️ Основные команды

### Разработка
```bash
npm run dev          # Запуск dev сервера
npm run build        # Сборка для продакшена
npm run preview      # Предпросмотр production сборки
```

### Качество кода
```bash
npm run lint         # Проверка кода (Biome)
npm run fix          # Автоматическое исправление
npm run format       # Форматирование кода
npm run typecheck    # Проверка типов TypeScript
npm run check        # Полная проверка (lint + types)
```

### Тестирование
```bash
npm run e2e:install  # Установка Playwright браузеров
npm run e2e:tests    # Запуск E2E тестов
npm run e2e:debug    # Тесты в режиме отладки
```

### GraphQL
```bash
npm run codegen      # Генерация типов из GraphQL схемы
npm run templates    # Компиляция шаблонов
```

## 🔧 Структура проекта

```
src/
├── components/     # UI компоненты
│   ├── _shared/    # Переиспользуемые компоненты
│   ├── Article/    # Компоненты статей
│   ├── Feed/       # Компоненты ленты
│   └── Views/      # Страницы приложения
├── context/        # Контексты и провайдеры
├── graphql/        # GraphQL запросы и типы
├── routes/         # Маршрутизация (file-based)
├── styles/         # Глобальные стили
└── utils/          # Утилиты и хелперы

public/
├── icons/          # SVG иконки
├── fonts/          # Шрифты (Muller)
├── sw.js           # Service Worker
└── offline.html    # Offline страница
```

## 🎯 Следующие шаги

После запуска разработки:

1. **Изучите архитектуру** - [Архитектура проекта](./../architecture/overview.md)
2. **Настройте IDE** - установите расширения для SolidJS и TypeScript
3. **Запустите тесты** - убедитесь что все работает
4. **Изучите функциональность** - начните с [авторизации](./../features/auth.md)

## 🚨 Распространенные проблемы

### Проблема: GraphQL codegen не работает
```bash
# Решение: проверить доступность API
curl -H "Content-Type: application/json" \
     -d '{"query":"query{__typename}"}' \
     https://v3.dscrs.site/graphql
```

### Проблема: CSS не компилируется
```bash
# Решение: очистить кэш и переустановить
rm -rf node_modules .vinxi
npm install
```

### Проблема: E2E тесты не запускаются
```bash
# Решение: установить браузеры
npm run e2e:install
```

## 📚 Полезные ресурсы

- [SolidJS документация](https://www.solidjs.com/docs)
- [Vite руководство](https://vitejs.dev/)
- [Biome линтер](https://biomejs.dev/)
- [GraphQL Codegen](https://the-guild.dev/graphql/codegen)

---

*Готово к разработке! Начните с изучения [архитектуры](./../architecture/overview.md)*
