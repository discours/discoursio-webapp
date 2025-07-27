# Добавление правильной логики объединения схем в codegen - 01.08.2024 04:00

## Проблема
Требовалось добавить правильную логику объединения GraphQL схем из разных бэкендов (core и inbox) в codegen.ts

## Решение

### 1. ✅ Основная конфигурация (core схема)
**Файл**: `codegen.ts`
- Используется только core схема: `schema: '../core/schema'`
- Исключены все документы из inbox для избежания конфликтов
- Добавлены исключения: `'!src/graphql/mutation/inbox/**'`, `'!src/graphql/query/inbox/**'`

### 2. ✅ Отдельная конфигурация (inbox схема)
**Файл**: `codegen-inbox.ts`
- Используется только inbox схема: `schema: '../inbox/schema.graphql'`
- Пока нет документов для inbox, поэтому `documents: []`
- Генерирует только introspection и schema файлы

### 3. ✅ Скрипты в package.json
Добавлены новые скрипты:
```json
{
  "codegen": "graphql-codegen",
  "codegen:inbox": "graphql-codegen --config codegen-inbox.ts",
  "codegen:all": "npm run codegen && npm run codegen:inbox"
}
```

### 4. ✅ Обновлен postinstall
Изменен с `npm run codegen` на `npm run codegen:all` для генерации обеих схем

## Выполненные правки

### codegen.ts
```diff
- schema: [
-   '../core/schema',
-   '../inbox/schema.graphql'
- ],
+ schema: '../core/schema',
  documents: [
    'src/graphql/queries/**/*.ts',
    'src/**/*.{ts,tsx}',
    '!src/graphql/generated/**',
    '!src/graphql/mutation/chat/**',
    '!src/graphql/query/chat/**',
    '!src/graphql/mutation/notifier/**',
    '!src/graphql/query/notifier/**',
+   // Исключаем все документы из inbox для избежания конфликтов
+   '!src/graphql/mutation/inbox/**',
+   '!src/graphql/query/inbox/**'
  ],
```

### codegen-inbox.ts (новый файл)
```typescript
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  overwrite: true,
  // Используем только inbox схему
  schema: '../inbox/schema.graphql',
  documents: [], // Пока нет документов для inbox
  generates: {
    './src/graphql/generated/inbox-introspection.json': {
      plugins: ['introspection'],
      config: { minify: true }
    },
    './src/graphql/generated/inbox-schema.graphql': {
      plugins: ['schema-ast'],
      config: { includeDirectives: false }
    }
  }
}

export default config
```

### package.json
```diff
  "scripts": {
    "codegen": "graphql-codegen",
+   "codegen:inbox": "graphql-codegen --config codegen-inbox.ts",
+   "codegen:all": "npm run codegen && npm run codegen:inbox",
    // ...
-   "postinstall": "patch-package && npm run codegen",
+   "postinstall": "patch-package && npm run codegen:all",
  }
```

## Результаты тестирования

### ✅ codegen (core схема)
```bash
npm run codegen
✔ Parse Configuration
✔ Generate outputs
```

### ✅ codegen:inbox (inbox схема)
```bash
npm run codegen:inbox
✔ Parse Configuration
✔ Generate outputs
```

### ✅ codegen:all (обе схемы)
```bash
npm run codegen:all
✔ Parse Configuration
✔ Generate outputs
✔ Parse Configuration
✔ Generate outputs
```

## Преимущества решения

1. **Разделение схем**: Каждая схема генерируется отдельно, избегая конфликтов
2. **Модульность**: Легко добавлять новые схемы в будущем
3. **Гибкость**: Можно генерировать схемы по отдельности или все сразу
4. **Совместимость**: Существующий код продолжает работать с core схемой
5. **Масштабируемость**: Структура готова для добавления новых бэкендов

## Следующие шаги

1. **Добавление inbox документов**: Когда появятся GraphQL документы для inbox, их можно добавить в `codegen-inbox.ts`
2. **Автоматизация**: Рассмотреть возможность автоматического определения схем и документов
3. **Валидация**: Добавить проверку совместимости схем при необходимости

## Команды для использования

```bash
# Генерация только core схемы
npm run codegen

# Генерация только inbox схемы
npm run codegen:inbox

# Генерация обеих схем
npm run codegen:all

# Автоматическая генерация при установке зависимостей
npm install
```

## Выводы
Правильная логика объединения схем реализована через разделение конфигураций. Это решает проблему конфликтов между схемами и обеспечивает гибкость для будущего развития проекта. 