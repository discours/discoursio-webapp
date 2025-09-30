# 🌟 Discours Webapp

![Version](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/discours/discoursio-webapp/dev/package.json&query=$.version&label=Version&color=blue)
![Lines](https://img.shields.io/badge/Lines-50K+-informational?style=flat&logo=typescript&logoColor=white)
![Files](https://img.shields.io/badge/Files-600+-informational?style=flat&logo=git&logoColor=white)
![Components](https://img.shields.io/badge/Components-130+-success?style=flat&logo=solid&logoColor=white&color=blue)
![CI/CD](https://img.shields.io/badge/CI/CD-Passing-blue?style=flat&logo=github-actions&logoColor=white)


![TypeScript](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/discours/discoursio-webapp/dev/package.json&query=$.devDependencies.typescript&label=TypeScript&color=3178c6&logo=typescript&logoColor=white)
![SolidJS](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/discours/discoursio-webapp/dev/package.json&query=$.devDependencies.solid-js&label=SolidJS&color=2c4f7c&logo=solid&logoColor=white)
![SolidStart](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/discours/discoursio-webapp/dev/package.json&query=$.devDependencies.@solidjs/start&label=SolidStart&color=2c4f7c&logo=solid&logoColor=white)
![SCSS](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/discours/discoursio-webapp/dev/package.json&query=$.devDependencies.sass&label=SCSS&color=cf649a&logo=sass&logoColor=white)
![Lightning CSS](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/discours/discoursio-webapp/dev/package.json&query=$.devDependencies.lightningcss&label=Lightning&color=ffd700&logo=lightning&logoColor=white)
![GraphQL](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/discours/discoursio-webapp/dev/package.json&query=$.devDependencies.graphql&label=GraphQL&color=e10098&logo=graphql&logoColor=white)
![i18next](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/discours/discoursio-webapp/dev/package.json&query=$.devDependencies.i18next&label=i18next&color=orange&logo=i18next&logoColor=white)
![Playwright](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/discours/discoursio-webapp/dev/package.json&query=$.devDependencies.@playwright/test&label=Playwright&color=2EAD33&logo=microsoft&logoColor=white)
![Biome](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/discours/discoursio-webapp/dev/package.json&query=$.devDependencies.@biomejs/biome&label=Biome&color=60a5fa&logo=biome&logoColor=white)

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

### 🔐 Настройка HTTPS для локальной разработки

Приложение автоматически использует HTTPS, если найдет сертификаты `localhost.pem` и `localhost-key.pem` в корне проекта.

#### Установка mkcert

**macOS:**
```shell
brew install mkcert
brew install nss  # для Firefox
```

**Windows (PowerShell с правами администратора):**
```powershell
choco install mkcert
# или
scoop bucket add extras
scoop install mkcert
```

**Linux (Ubuntu/Debian):**
```shell
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
```

#### Генерация сертификатов

```shell
# 1. Установить локальный CA (один раз)
mkcert -install

# 2. Создать сертификаты для localhost
mkcert localhost 127.0.0.1 ::1

# 3. Запустить dev сервер (автоматически найдет сертификаты)
npm run dev
```

Приложение будет доступно по адресу `https://localhost:3000`

> **Примечание**: Если сертификаты не найдены, сервер запустится по HTTP на `http://localhost:3000`

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

- 📋 **[Основная документация](docs/README.md)** — Обзор всех возможностей
- 🧪 **[Тестирование](docs/testing.md)** - Гид по автоматизации контроля качества
- 🎨 **[Open Graph система](docs/open-graph.md)** — Метатеги и социальные сети  
- 🏗️ **[Архитектура](docs/architecture.md)** — Структура и паттерны
- 🔌 **[API функции](docs/api-functions.md)** — Серверные функции
- 🖼️ **[Система изображений](docs/image-caching.md)** — Кеширование и оптимизация

---

## 🤝 Участие в разработке

**Мы приветствуем участие!** Пожалуйста, ознакомьтесь с [руководством по участию](docs/contributing.md) перед отправкой PR.

![Last Commit](https://img.shields.io/badge/dynamic/json?url=https://api.github.com/repos/discours/discoursio-webapp&query=$.updated_at&label=Last%20Update&color=blue&logo=github&logoColor=white)
![Repository Size](https://img.shields.io/badge/dynamic/json?url=https://api.github.com/repos/discours/discoursio-webapp&query=$.size&label=Repo%20Size&color=informational&logo=github&logoColor=white)


![Made with Love](https://img.shields.io/badge/Made%20with-❤️-gray?style=flat&logo=heart)
![Open Source](https://img.shields.io/badge/Open-Source-gray?style=flat&logo=github&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-gray?style=flat&logo=license)
