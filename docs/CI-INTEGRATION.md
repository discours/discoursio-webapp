# 🔧 Интеграция отчета о покрытии тестами с Gitea CI

## 📋 Обзор

Система мониторинга тестов полностью интегрирована с Gitea CI/CD пайплайном и автоматически генерирует отчеты о покрытии при каждом запуске тестов.

## 🚀 Workflow файлы

### 1. Основной CI Pipeline (`.gitea/workflows/main.yml`)

**Что делает:**
- Запускает тесты на каждой ветке
- Генерирует отчет о покрытии
- Архивирует результаты в артефакты

**Ключевые шаги:**
```yaml
# Генерируем отчет о покрытии тестами
- name: Generate Test Coverage Report
  if: always() # Выполняем даже если тесты провалились
  run: |
    echo "📊 Генерация отчета о покрытии тестами..."
    npm run test:coverage

# Архивируем отчет о покрытии
- name: Archive Test Coverage Report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-coverage-report
    path: docs/test-coverage/
    retention-days: 30

# Выводим краткую статистику в логи CI
- name: Display Test Statistics
  if: always()
  run: |
    echo "📈 СТАТИСТИКА ТЕСТОВ В CI"
    npm run test:stats
```

### 2. Мониторинг покрытия (`.gitea/workflows/test-coverage.yml`)

**Что делает:**
- Запускается после завершения основного CI
- Анализирует результаты тестов
- Создает детальный отчет

**Триггеры:**
```yaml
on:
  workflow_run:
    workflows: ["CI Pipeline"]
    types: [completed]
    branches: [main, dev]
```

### 3. Еженедельный отчет (`.gitea/workflows/weekly-coverage.yml`)

**Что делает:**
- Автоматический запуск каждое воскресенье
- Отслеживание трендов покрытия
- Долгосрочное хранение отчетов

**Расписание:**
```yaml
on:
  schedule:
    - cron: '0 9 * * 0'  # Каждое воскресенье в 9:00 UTC
  workflow_dispatch:      # Ручной запуск
```

## 📊 Что генерируется в CI

### В логах CI
```
📈 СТАТИСТИКА ТЕСТОВ В CI
═══════════════════════════════════════════════════════════════
📊 Всего тестов:           27
✅ Пройдено:               25
❌ Провалено:               2
⏭️ Пропущено:               0
🔄 Нестабильные:            0
📁 Файлов тестов:          27
═══════════════════════════════════════════════════════════════
📈 Процент успеха:       92.6%
📊 Прогресс:         [████████████████████░░░░░░░░░░] 92.6%
```

### В артефактах
- **`e2e-test-results`** - результаты тестов (5 дней)
- **`test-coverage-report`** - отчет о покрытии (30 дней) - **только при успешных тестах**
- **`coverage-report-{branch}`** - отчет по ветке (90 дней) - **только при успешных тестах**
- **`weekly-coverage-{date}`** - еженедельный отчет (365 дней)

**Примечание:** Отчеты о покрытии генерируются только при `if: success()`, экономя ресурсы CI.

## 🔍 Доступ к отчетам

### В Gitea UI
1. Перейти в **Actions** → **Workflows**
2. Выбрать нужный workflow run
3. Скачать артефакт `test-coverage-report`
4. Открыть `index.html` в браузере

### Локально
```bash
# Быстрый просмотр статистики
npm run test:stats

# Генерация детального отчета
npm run test:coverage

# Открыть HTML отчет
open docs/test-coverage/index.html
```

## ⚙️ Настройка и кастомизация

### Переменные окружения
```yaml
env:
  CI: true
  SASS_FORCE_JS: true
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: 1
  TEST_USERNAME: ${{ secrets.E2E_TEST_USERNAME }}
  TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
  E2E_BASE_URL: http://localhost:3001  # HTTP для локального dev сервера
  PUBLIC_CORE_API: https://v3.dscrs.site/graphql  # Внешний API сервер
```

**Важно:** Dev сервер проксирует `/graphql` на `PUBLIC_CORE_API`, поэтому `E2E_BASE_URL` должен быть HTTP.

### Условия выполнения
```yaml
# Выполняем даже если тесты провалились
if: always()

# Только для определенных веток
if: github.ref == 'refs/heads/main'

# После успешного выполнения другого job
needs: [build-and-test]
```

### Retention policies
```yaml
retention-days: 30    # Основные отчеты
retention-days: 90    # Отчеты по веткам
retention-days: 365   # Еженедельные отчеты
```

## 📈 Мониторинг и алерты

### Автоматические уведомления
- **При провале тестов**: Отчет НЕ генерируется (экономия ресурсов)
- **При успешных тестах**: Полный отчет о покрытии
- **При низком покрытии**: Рекомендации в отчете
- **При нестабильных тестах**: Отдельная категория в статистике

### Метрики качества
- **Процент успеха**: Цель > 90%
- **Покрытие функциональности**: Цель > 80%
- **Стабильность тестов**: Цель < 5% нестабильных

## 🚨 Troubleshooting

### Проблемы с генерацией отчета
```bash
# Проверить права на выполнение
chmod +x scripts/test-coverage.js

# Проверить зависимости
npm ci --no-optional

# Запустить вручную
npm run test:coverage
```

### Проблемы с GHES совместимостью
```bash
# Ошибка: GHESNotSupportedError: @actions/artifact v2.0.0+ not supported
# Решение: Используйте actions/upload-artifact@v3 вместо @v4

# В .gitea/workflows/*.yml замените:
# uses: actions/upload-artifact@v4
# на:
# uses: actions/upload-artifact@v3

# И аналогично для download-artifact:
# uses: actions/download-artifact@v3
```

### Совместимые версии actions для GHES
- ✅ `actions/checkout@v4` - поддерживается
- ✅ `actions/setup-node@v4` - поддерживается  
- ❌ `actions/upload-artifact@v4` - НЕ поддерживается
- ❌ `actions/download-artifact@v4` - НЕ поддерживается
- ✅ `actions/upload-artifact@v3` - поддерживается
- ✅ `actions/download-artifact@v3` - поддерживается

### Проблемы с артефактами
- Проверить размер артефактов (лимит Gitea)
- Увеличить retention-days если нужно
- Проверить права доступа к workflow

### Проблемы с расписанием
- Проверить cron синтаксис
- Убедиться что workflow не заблокирован
- Проверить логи выполнения

## 🔮 Будущие улучшения

### Планируемые функции
- [ ] Интеграция с Slack/Discord для уведомлений
- [ ] Автоматические PR комментарии с покрытием
- [ ] Графики трендов покрытия
- [ ] Сравнение покрытия между ветками
- [ ] Интеграция с внешними системами мониторинга

### Расширение метрик
- [ ] Время выполнения тестов
- [ ] Покрытие по типам тестов
- [ ] Анализ флаки тестов
- [ ] Рекомендации по оптимизации

---

*Документация обновлена: ${new Date().toLocaleDateString('ru-RU')}*
