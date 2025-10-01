# GraphQL Codegen Plugins Configuration

## 📋 Оглавление

- [Установленные плагины](#установленные-плагины)
- [Структура сгенерированных файлов](#структура-сгенерированных-файлов)
- [Примеры использования](#примеры-использования)
- [Конфигурация](#конфигурация)
- [Команды](#команды)
- [Рекомендации](#рекомендации)
- [Обновление](#обновление)
- [Архитектура GraphQL клиента](#архитектура-graphql-клиента)

Этот документ описывает настройку и использование плагинов GraphQL Codegen в проекте.

## Установленные плагины

### 1. **Client Preset** (Основа)
- **Пакет**: `@graphql-codegen/client-preset`
- **Назначение**: Современный подход к генерации GraphQL кода
- **Генерирует**: `gql.ts`, `graphql.ts`

**Преимущества:**
- Автоматическое управление фрагментами
- Оптимизированная генерация запросов
- Встроенная поддержка TypeScript
- Минимальная конфигурация

### 2. **TypeScript + Operations**
- **Пакеты**: `@graphql-codegen/typescript`, `@graphql-codegen/typescript-operations`
- **Назначение**: Базовая типизация для всех GraphQL типов и операций
- **Генерирует**: `types.ts`

**Ключевые настройки:**
```typescript
config: {
  enumsAsTypes: false,           // Генерировать enums как значения
  onlyOperationTypes: false,     // Включить все типы схемы
  exportFragmentSpreadSubTypes: true,
  skipTypename: false
}
```

### 3. **TypedDocumentNode**
- **Пакет**: `@graphql-codegen/typed-document-node`
- **Назначение**: Compile-time типизация запросов с нулевыми runtime накладными расходами
- **Генерирует**: `typed-document-nodes.ts`

**Использование:**
```typescript
import { gql } from '~/graphql/generated/graphql'

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }
`
// GET_USER автоматически типизирован!
```

### 4. **Introspection** ⭐ *Основной*
- **Пакет**: `@graphql-codegen/introspection`
- **Назначение**: Генерация интроспекции схемы для dev tools
- **Генерирует**: `introspection.json`

**Использование:**
- GraphQL Playground
- Apollo Studio
- Debugging tools
- Schema validation

### 5. **Schema AST** ⭐ *Основной*
- **Пакет**: `@graphql-codegen/schema-ast`
- **Назначение**: Человекочитаемая схема GraphQL
- **Генерирует**: `schema.graphql`

**Преимущества:**
- Удобный просмотр схемы
- Документация API
- Schema diffing
- Версионирование

## Структура сгенерированных файлов

```
src/graphql/generated/
├── index.ts                    # Основные экспорты
├── gql.ts                      # Client preset gql функция
├── graphql.ts                  # Client preset типы
├── types.ts                    # Все GraphQL типы
├── typed-document-nodes.ts     # TypedDocumentNode экспорты
├── introspection.json          # Интроспекция схемы
└── schema.graphql              # Человекочитаемая схема
```

## Примеры использования

### Client Preset подход (Рекомендуется)
```typescript
import { gql } from '~/graphql/generated'

const GET_POSTS = gql`
  query GetPosts {
    posts {
      id
      title
    }
  }
`
```

### Импорт типов сущностей
```typescript
import { Author, ReactionKind, ShoutsOrderBy } from '~/graphql/generated'

// Использование enums как значений
const reaction = ReactionKind.Comment
const order = ShoutsOrderBy.Rating
```

### TypedDocumentNode
```typescript
import { TypedDocumentNode } from '~/graphql/generated/typed-document-nodes'

// Полная типизация на уровне компиляции
```

## Конфигурация

### Исключения
Следующие директории исключены из генерации:
- `src/graphql/mutation/chat/**`
- `src/graphql/query/chat/**`
- `src/graphql/api/chat/**`
- Проблемные notifier файлы

### Скалярные типы
```typescript
scalars: {
  DateTime: 'string',
  JSON: 'Record<string, any>'
}
```

## Команды

```bash
# Генерация всех файлов
npm run codegen

# Просмотр схемы
cat src/graphql/generated/schema.graphql

# Просмотр интроспекции
jq . src/graphql/generated/introspection.json
```

## Рекомендации

1. **Используйте Client Preset** для новых запросов
2. **Импортируйте типы** из `~/graphql/generated`
3. **Используйте TypedDocumentNode** для максимальной типизации
4. **Проверяйте schema.graphql** для понимания API
5. **Используйте introspection.json** в dev tools
6. **Используйте URQL клиент** для выполнения запросов

## Обновление

При изменении схемы GraphQL:
```bash
npm run codegen
```

## Архитектура GraphQL клиента

Проект использует **URQL** в качестве основного GraphQL клиента:

```typescript
import { createClient, fetchExchange, cacheExchange } from '@urql/core'

// Создание клиента
const client = createClient({
  url: 'https://api.example.com/graphql',
  exchanges: [fetchExchange, cacheExchange]
})

// Выполнение запроса
const result = await client.query(GET_POSTS, {}).toPromise()
```

**Преимущества URQL:**
- Встроенная система кеширования
- Поддержка SSR
- Интеграция с SolidJS
- Расширяемая архитектура exchanges
