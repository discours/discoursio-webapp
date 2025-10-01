# 🌟 Discours Webapp

**Современный веб-интерфейс** для платформы Discours — открытого журнала о культуре, науке и обществе.

## 📋 Содержание

- [🚀 Технологический стек](#-технологический-стек)
- [🛠️ Разработка](#️-разработка)
  - [📦 Подготовка окружения](#-подготовка-окружения)
  - [🔐 Настройка HTTPS](#-настройка-https-для-локальной-разработки)
  - [⚡ Основные команды](#-основные-команды)
- [📚 Документация](#-документация)
- [🤝 Участие в разработке](#-участие-в-разработке)

## 🛠️ Разработка

### 📦 Подготовка окружения

```shell
# Клонирование репозитория
git clone https://github.com/discours/discoursio-webapp.git
cd discoursio-webapp

# Установка зависимостей
npm install  # или bun/pnpm/yarn

# Настройка переменных окружения
cp .env.example .env
```

### 🔐 HTTPS для локальной разработки (автоматически)

При первом запуске `npm run dev` приложение **автоматически**:
1. Проверит и установит `mkcert` (macOS/Linux)
2. Создаст локальный CA и сертификаты
3. Запустится на `https://localhost:3000`

```shell
npm run dev  # 🔒 Автоматически настроит HTTPS (если mkcert установлен)
             # 🌐 или HTTP (если mkcert не установлен)
```

**Windows:** При первом запуске увидите инструкцию:
1. Установите [Chocolatey](https://chocolatey.org/install) (если нет)
2. Запустите PowerShell **от администратора**
3. Выполните: `choco install mkcert -y`
4. Перезапустите `npm run dev`

### ⚡ Основные команды

```bash
# Разработка
npm run dev         # 🚀 Запуск сервера разработки
npm run build       # 📦 Сборка для продакшена
npm run preview     # 👀 Предпросмотр сборки

# Качество кода
npm run typecheck   # 🔍 Проверка типов TypeScript
npm run lint        # 🧹 Линтинг кода
npm run fix         # 🔧 Автоисправление стилей
npm run format      # 💅 Форматирование кода

# Дополнительно
npm run storybook   # 📚 Запуск Storybook
npm run analyze     # 📊 Анализ бандла
```

### 📖 Важное

- 📚 **[Документация](docs/README.md)** — Полный обзор проекта
- 🏗️ **[Архитектура](docs/architecture/overview.md)** — Структура и технологии
- ⚡ **[Разработка](docs/development/workflow.md)** — Процессы разработки
- 🎨 **[Функциональность](docs/features/auth.md)** — Основные возможности
- 🛠️ **[Справочники](docs/reference/commands.md)** — Команды и настройки
- 🧪 **[Тестирование](docs/development/testing.md)** — Автоматизация качества

---

## 🤝 Участие в разработке

**Мы приветствуем участие!** Пожалуйста, ознакомьтесь с [руководством по участию](docs/development/contributing.md) перед отправкой PR.

![Last Commit](https://img.shields.io/badge/dynamic/json?url=https://api.github.com/repos/discours/discoursio-webapp&query=$.updated_at&label=Last%20Update&color=blue&logo=github&logoColor=white)
![Repository Size](https://img.shields.io/badge/dynamic/json?url=https://api.github.com/repos/discours/discoursio-webapp&query=$.size&label=Repo%20Size&color=informational&logo=github&logoColor=white)


![Made with Love](https://img.shields.io/badge/Made%20with-❤️-gray?style=flat&logo=heart)
![Open Source](https://img.shields.io/badge/Open-Source-gray?style=flat&logo=github&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-gray?style=flat&logo=license)
