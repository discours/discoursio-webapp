# 🌟 Discours Webapp

![Version](https://img.shields.io/badge/version-0.11.8-blue.svg?style=flat)
![Tests](https://img.shields.io/badge/Tests-12_specs-28a745?style=flat&logo=playwright)
![Docs](https://img.shields.io/badge/Docs-29_files-6f42c1?style=flat&logo=markdown)
![Lines](https://img.shields.io/badge/Lines-45K+-informational?style=flat)
![Files](https://img.shields.io/badge/Files-593-informational?style=flat) 
![Components](https://img.shields.io/badge/Components-120+-success?style=flat)
![MIT](https://img.shields.io/badge/License-MIT-green?style=flat)

**Современный веб-интерфейс** для платформы Discours — открытого журнала о культуре, науке и обществе.

## 📋 Содержание

- [🚀 Технологический стек](#-технологический-стек)
- [🛠️ Разработка](#️-разработка)
  - [📦 Подготовка окружения](#-подготовка-окружения)
  - [🔐 Настройка HTTPS](#-настройка-https-для-локальной-разработки)
  - [⚡ Основные команды](#-основные-команды)
- [📚 Документация](#-документация)
- [🤝 Участие в разработке](#-участие-в-разработке)

## 🚀 Технологический стек

![SolidJS](https://img.shields.io/badge/Frontend-SolidJS-2c4f7c?style=flat&logo=solid)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178c6?style=flat&logo=typescript)
![SCSS](https://img.shields.io/badge/Styles-SCSS-cf649a?style=flat&logo=sass)
![SSR](https://img.shields.io/badge/SSR-SolidStart-2c4f7c?style=flat)
![Responsive](https://img.shields.io/badge/Responsive-Mobile_First-success?style=flat)
![URQL](https://img.shields.io/badge/GraphQL-URQL-e10098?style=flat&logo=graphql)
![CodeGen](https://img.shields.io/badge/Codegen-GraphQL-e10098?style=flat)
![i18next](https://img.shields.io/badge/Languages-RU/EN-orange?style=flat)
![Vinxi](https://img.shields.io/badge/Build-Vinxi-orange?style=flat)
![Vite](https://img.shields.io/badge/Bundler-Vite-646cff?style=flat&logo=vite)
![Biome](https://img.shields.io/badge/Linter-Biome-60a5fa?style=flat)

## 🛠️ Разработка

### 📦 Подготовка окружения

```shell
# Клонирование репозитория
git clone https://github.com/discours/discoursio-webapp.git
cd discoursio-webapp

# Установка зависимостей
bun install  # или npm/pnpm/yarn

# Настройка переменных окружения
cp .env.example .env
```

### 🔐 Настройка HTTPS для локальной разработки

```shell
# Установка mkcert (Ubuntu/Debian)
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert

# Создание локального CA
mkcert -install

# Запуск сервера разработки
bun dev
```

### ⚡ Основные команды

```bash
# Разработка
bun run dev         # 🚀 Запуск сервера разработки
bun run build       # 📦 Сборка для продакшена
bun run preview     # 👀 Предпросмотр сборки

# Качество кода
bun run typecheck   # 🔍 Проверка типов TypeScript
bun run lint        # 🧹 Линтинг кода
bun run fix         # 🔧 Автоисправление стилей
bun run format      # 💅 Форматирование кода

# Дополнительно
bun run storybook   # 📚 Запуск Storybook
bun run analyze     # 📊 Анализ бандла
```


## 📚 Документация

![API Docs](https://img.shields.io/badge/API_Docs-GraphQL-ff6b6b?style=flat)
![Coverage Docs](https://img.shields.io/badge/Coverage-95%25-brightgreen?style=flat)

### 📖 Важное

- 📋 **[Основная документация](docs/README.md)** — Обзор всех возможностей
- 🧪 **[Тестирование](docs/testing.md)** - Гид по автоматизации контроля качества
- 🎨 **[Open Graph система](docs/open-graph.md)** — Метатеги и социальные сети  
- 🏗️ **[Архитектура](docs/architecture.md)** — Структура и паттерны
- 🔌 **[API функции](docs/api-functions.md)** — Серверные функции
- 🖼️ **[Система изображений](docs/image-caching.md)** — Кеширование и оптимизация

---

## 🤝 Участие в разработке

![Contributing](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat)

**Мы приветствуем участие!** Пожалуйста, ознакомьтесь с [руководством по участию](docs/contributing.md) перед отправкой PR.

---

**Сделано с ❤️ командой Discours**

![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red?style=flat)
![Open Source](https://img.shields.io/badge/Open-Source-blue?style=flat)
