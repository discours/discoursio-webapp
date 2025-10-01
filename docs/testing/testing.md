
# 🧪 Тестирование

## 📋 Оглавление

- [🎯 Стратегия тестирования](#-стратегия-тестирования)
- [📊 Уровни тестирования](#-уровни-тестирования)
- [⚡ Специализированные тесты](#-специализированные-тесты)
- [⚡ Команды тестирования](#-команды-тестирования)

## 🎯 Стратегия тестирования

![Playwright](https://img.shields.io/badge/Playwright-E2E-2ecc71?style=flat&logo=playwright)
![API Tests](https://img.shields.io/badge/API_Tests-/api/og-blue?style=flat)

![WebKit](https://img.shields.io/badge/WebKit-Safari-1976d2?style=flat)
![Chromium](https://img.shields.io/badge/Chromium-Chrome-4285f4?style=flat)
![Firefox](https://img.shields.io/badge/Firefox-Gecko-ff7139?style=flat)

### 📊 Подробная статистика тестов

| **Тип тестов** | **Файлов** | **Покрытие** | **Статус** |
|----------------|------------|--------------|------------|
| 🌐 **E2E Tests** | `8 файлов` | Компоненты, авторизация, черновики | ✅ Активные |
| 🔗 **API Tests** | `1 файл` | Open Graph API эндпоинты | ✅ Новые |
| 📋 **Meta Tests** | `1 файл` | OG метатеги на страницах | ✅ Новые |
| 🔄 **Integration** | `1 файл` | Полная система OG | ✅ Новые |
| 📄 **Components** | `1 файл` | UI компоненты | ✅ Активные |

### 🎯 Специализированные тесты

**🎨 Open Graph Suite** (Новое в v0.11.6):
- ✅ **API тестирование** — `/api/og` для статей, авторов, тем
- ✅ **Метатеги** — Проверка всех OG/Twitter/VK тегов
- ✅ **Интеграция** — Производительность, валидность, консистентность
- ✅ **Безопасность** — Корректная обработка спецсимволов

### ⚡ Команды тестирования

```bash
# Установка и настройка
bun run e2e:install     # 📥 Установка Playwright (теперь Chromium для стабильности)
bun run e2e:install:ci  # 🤖 Установка для CI

# Запуск тестов
bun run e2e:tests       # 🧪 Все E2E тесты (Chromium)
bun run e2e:tests:ci    # 🚀 Тесты в CI режиме (оптимизированы)
bun run e2e:og          # 🎨 Только Open Graph тесты

# Отладка
bun run e2e:debug       # 🐛 Режим отладки
bun run e2e:headed      # 👁️ Тесты с UI браузера

# CI оптимизации (новое в v0.12.1)
# ✅ Ubuntu 22.04 вместо устаревшей ubuntu-latest
# ✅ Chromium вместо проблемного WebKit fallback  
# ✅ Кэширование Playwright браузеров
# ✅ Автоматическая загрузка артефактов при ошибках
# ✅ Умная конфигурация для CI/локальной разработки
```