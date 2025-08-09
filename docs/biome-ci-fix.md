# Исправление проблемы Biome в CI/CD

## Проблема

В CI/CD окружении (Linux) возникала ошибка:
```
Error: Cannot find module '@biomejs/cli-linux-x64/biome'
```

## Причина

Проблема возникала из-за того, что в `package-lock.json` были зафиксированы платформо-специфичные пакеты для Darwin (macOS):
- `@biomejs/cli-darwin-arm64`
- `@biomejs/cli-darwin-x64`

При установке в Linux CI эти пакеты отсутствовали, что приводило к ошибке.

## Решение

### 1. Локальное исправление

Удалить платформо-специфичные пакеты и переустановить Biome:

```bash
npm uninstall @biomejs/cli-darwin-arm64 @biomejs/cli-darwin-x64
npm install
```

### 2. Обновление CI/CD конфигурации

Добавить в CI/CD workflows шаг для очистки платформо-специфичных зависимостей:

```yaml
- name: Clean Platform-Specific Dependencies
  run: |
    # Удаляем платформо-специфичные пакеты для Linux CI
    npm uninstall sass-embedded-darwin-arm64 sass-embedded-darwin-x64 || true
    npm uninstall @biomejs/cli-darwin-arm64 @biomejs/cli-darwin-x64 || true
    # Заменяем платформенные пакеты на кросс‑платформенный sass-embedded
    npm pkg delete dependencies.sass-embedded-darwin-arm64 || true
    npm pkg delete dependencies.sass-embedded-darwin-x64 || true
    npm pkg set devDependencies.sass-embedded="^1.90.0"
    # Принудительно переустанавливаем зависимости
    npm uninstall @biomejs/biome || true
    npm install @biomejs/biome@^2.1.1
    npm install
```

## Обновленные файлы

- `.gitea/workflows/main.yml` - обновлен для Gitea CI
- `.github/workflows/node-ci.yml` - обновлен для GitHub Actions

## Профилактика

1. При разработке на macOS избегать фиксации платформо-специфичных пакетов в `package-lock.json`
2. Регулярно проверять CI/CD на разных платформах
3. Использовать `.npmrc` для исключения платформо-специфичных пакетов при необходимости

## Тестирование

После исправления проверить:
- `npm run lint` - работает локально
- `npm run check` - работает локально
- CI/CD pipeline проходит успешно 