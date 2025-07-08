# GraphQL Codegen Plugins Configuration

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

### 4. **GraphQL Request SDK**
- **Пакет**: `@graphql-codegen/typescript-graphql-request`
- **Назначение**: Готовые к использованию функции для выполнения запросов
- **Генерирует**: `sdk.ts`

**Использование:**
```typescript
import { getSdk } from '~/graphql/generated'

const client = new GraphQLClient('https://api.example.com/graphql')
const sdk = getSdk(client)

// Типизированные функции для всех операций
const user = await sdk.GetUser({ id: '123' })
```

### 5. **Introspection** ⭐ *Добавлен*
- **Пакет**: `@graphql-codegen/introspection`
- **Назначение**: Генерация интроспекции схемы для dev tools
- **Генерирует**: `introspection.json`

**Использование:**
- GraphQL Playground
- Apollo Studio
- Debugging tools
- Schema validation

### 6. **Schema AST** ⭐ *Добавлен*
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
├── sdk.ts                      # GraphQL Request SDK
├── typed-document-nodes.ts     # TypedDocumentNode экспорты
├── introspection.json          # Интроспекция схемы
└── schema.graphql              # Человекочитаемая схема
```

## Примеры использования

### Client Preset подход
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

### SDK подход
```typescript
import { getSdk } from '~/graphql/generated'

const sdk = getSdk(client)
const posts = await sdk.GetPosts()
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
3. **Используйте SDK** для готовых функций
4. **Используйте TypedDocumentNode** для максимальной типизации
5. **Проверяйте schema.graphql** для понимания API
6. **Используйте introspection.json** в dev tools

## Обновление

При изменении схемы GraphQL:
```bash
npm run codegen
```

Все файлы будут автоматически перегенерированы с актуальными типами. 