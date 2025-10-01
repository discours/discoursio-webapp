# NPM Scripts Документация

## 🚀 Основные команды разработки

### **Запуск и сборка**
```bash
npm run dev          # Запуск dev сервера с HMR
npm run build        # Production сборка
npm start            # Запуск production сервера
npm run start:debug  # Запуск с отладчиком Node.js
```

## 🔍 Проверка кода

### **Линтинг и форматирование (Biome)**
```bash
npm run lint         # Проверка кода без исправлений
npm run lint:fix     # Проверка и автоматическое исправление ошибок  
npm run format       # Форматирование всего кода
npm run fix          # Полное исправление: lint + format
```

### **Проверка типов (TypeScript)**
```bash
npm run typecheck    # Проверка TypeScript типов без компиляции
npm run check        # Полная проверка: lint + typecheck
```

## 🧪 Тестирование

### **E2E тесты (Playwright)**
```bash
npm run e2e:install  # Установка Playwright браузеров
npm run e2e:tests    # Запуск E2E тестов (chromium)
npm run e2e:tests:ci # Запуск в CI режиме
npm run e2e          # Полный E2E прогон с окружением
```

## 🔧 Инструменты

### **GraphQL Codegen**
```bash
npm run codegen      # Генерация TypeScript типов из GraphQL схем
```

### **Шаблоны**
```bash
npm run templates    # Компиляция шаблонов
```

### **Очистка**
```bash
npm run clean        # Очистка build директорий
npm run reset        # Полная очистка + переустановка зависимостей
```

## 📋 Автоматические хуки

### **PostInstall**
```bash
# Выполняется автоматически после npm install
patch-package        # Применение патчей к зависимостям
npm run codegen      # Генерация GraphQL типов
```

### **PreStart**
```bash
# Выполняется автоматически перед npm start
npm run build        # Сборка для production
```

## 🛠️ Workflow рекомендации

### **Разработка**
```bash
# Стандартный цикл разработки
npm run dev          # Запуск dev сервера
npm run check        # Проверка перед коммитом
npm run fix          # Автоматическое исправление
```

### **CI/CD**
```bash
# Последовательность для CI
npm install          # + автоматически postinstall
npm run check        # Проверка кода и типов
npm run e2e:tests:ci # E2E тесты
npm run build        # Production сборка
```

### **Очистка проблем**
```bash
# При проблемах с зависимостями
npm run reset        # Полная переустановка
npm run codegen      # Перегенерация GraphQL типов
```

## ⚡ Оптимизации

### **Lightning CSS интеграция**
- CSS трансформация и минификация автоматическая
- Не требует отдельных команд
- Встроена в `dev` и `build` процессы

### **Biome заменяет**
- ✅ ESLint линтинг
- ✅ Prettier форматирование  
- ✅ Единая конфигурация
- ⚡ 10-100x быстрее традиционных инструментов

### **Removed tools**
- ❌ Stylelint (заменен Lightning CSS)
- ❌ PostCSS отдельные плагины
- ❌ Множественные линтеры

---

**Итого**: Современный, быстрый toolchain с минимумом зависимостей! 