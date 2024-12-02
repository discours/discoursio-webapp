# Discoursio Webapp

## Технологический стек

- [TypeScript](https://www.typescriptlang.org/)
- [SolidJS](https://www.solidjs.com/)
- [SolidStart](https://start.solidjs.com/)
- [Vinxi](https://vinxi.vercel.app/)
- [SCSS](https://sass-lang.com/)
- [URQL](https://formidable.com/open-source/urql/)
- [i18next](https://www.i18next.com/)
- [Tiptap](https://tiptap.dev/)
- [Playwright](https://playwright.dev/)
- [Stylelint](https://stylelint.io/)
- [Biome](https://biomejs.dev/)

## Разработка

### Начало работы

1. Клонируйте репозиторий
2. Установите зависимости: `bun i` (или npm/pnpm/yarn)
3. Создайте `.env` файл (переменные с `PUBLIC_` используются в `/src/utils/config.ts`)

### Installing cert server on local

1. Install mkcert:
```
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
```
2. Create a local CA (Certificate Authority):
```
mkcert -install
```
3. After installing mkcert, you should be able to run your development server:
```
bun dev
```

### Основные команды

```bash
bun run dev         # Запуск сервера разработки
bun run build       # Сборка для продакшена
bun run typecheck   # Проверка типов
bun run fix         # Исправление стилей и линтинг
bun run storybook   # Запуск Storybook
```

## Тестирование

### E2E тесты (Playwright)

```bash
bun run e2e:install  # Установка зависимостей для E2E
bun run e2e:tests    # Запуск тестов
bun run e2e:tests:ci # Запуск тестов в CI
```

## CI/CD

Тесты выполняются в GitHub Actions. Убедитесь, что `BASE_URL` корректно настроен в CI.

## Версия: 0.9.7

## Технологии

- [SolidJS](https://www.solidjs.com/) - реактивная библиотека
- [SolidStart](https://start.solidjs.com/) - SSR фреймворк

## Архитектура

### Загрузка данных
- Используется createResource для загрузки данных
- Автоматическое отслеживание зависимостей
- Встроенная обработка состояний loading/error
- Оптимизированная работа с SSR

### Server-Side Rendering
- Предзагрузка данных через route.load
- Оптимизированная гидрация через ssrLoadFrom
- Предотвращение повторных запросов
- Кеширование данных на клиенте
[Документация](docs/README.md)
