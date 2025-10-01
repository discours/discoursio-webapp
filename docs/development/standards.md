# 📏 Стандарты разработки

## 📋 Оглавление

- [🎯 Правила кодирования](#-правила-кодирования)
- [📝 Общие принципы](#-общие-принципы)
- [🔧 TypeScript стандарты](#-typescript-стандарты)
- [🎨 Стили и форматирование](#-стили-и-форматирование)
- [🏗️ Архитектурные стандарты](#️-архитектурные-стандарты)
- [🔒 Безопасность](#-безопасность)
- [🌍 Интернационализация](#-интернационализация)
- [🧪 Тестирование](#-тестирование)
- [📝 Документирование](#-документирование)
- [🚀 Производительность](#-производительность)
- [🔧 Инструменты](#-инструменты)
- [📋 Чек-лист качества](#-чек-лист-качества)

## 🎯 Правила кодирования

Соблюдение стандартов обеспечивает качество и читаемость кода.

### 📝 Общие принципы

#### Единая ответственность
Каждый модуль должен иметь одну четкую цель:

```typescript
// ✅ Хорошо - компонент только отображает данные
function ArticleCard({ article }: { article: Article }) {
  return <div>{article.title}</div>
}

// ❌ Плохо - смешивание логики и отображения
function ArticleCard({ article }: { article: Article }) {
  const [likes, setLikes] = createSignal(0)

  onMount(async () => {
    const data = await fetchLikes(article.id)
    setLikes(data.count)
  })

  return <div>{article.title} - {likes()}</div>
}
```

#### Читаемость кода
Код должен быть понятен без дополнительных объяснений:

```typescript
// ✅ Хорошо - явные имена и структура
const calculateTotalPrice = (items: CartItem[], discount: number) => {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  return subtotal * (1 - discount)
}

// ❌ Плохо - неясные сокращения
const calcTP = (items, disc) => {
  const st = items.reduce((s, i) => s + i.price, 0)
  return st * (1 - disc)
}
```

### 🔧 TypeScript стандарты

#### Строгая типизация
Использовать строгие типы для всех данных:

```typescript
// ✅ Хорошо - полная типизация
interface User {
  id: string
  name: string
  email: string
  preferences: UserPreferences
}

type UserPreferences = {
  theme: 'light' | 'dark'
  notifications: boolean
}

// ✅ Хорошо - типизированные функции
const updateUser = async (user: User): Promise<User> => {
  // реализация
}

// ❌ Плохо - слабая типизация
const updateUser = async (user: any): Promise<any> => {
  // реализация
}
```

#### Избегать any типа
Использовать конкретные типы или утилиты:

```typescript
// ✅ Хорошо - конкретные типы
type ApiResponse<T> = {
  data: T
  error?: string
  status: number
}

// ✅ Хорошо - утилиты типов
type NonEmptyArray<T> = [T, ...T[]]

// ❌ Плохо - any тип
type ApiResponse = {
  data: any
  error?: any
}
```

### 🎨 Стили и форматирование

#### Biome конфигурация
```json
{
  "files": {
    "include": ["src/**/*", "tests/**/*"]
  },
  "formatter": {
    "enabled": true,
    "lineWidth": 120
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

#### SCSS модули
Использовать модульные стили для компонентов:

```scss
// Button.module.scss
.button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;

  &:hover {
    opacity: 0.8;
  }

  &.primary {
    background: var(--primary-color);
    color: white;
  }
}
```

```typescript
// Button.tsx
import styles from './Button.module.scss'

export function Button({ variant = 'primary' }) {
  return (
    <button class={clsx(styles.button, styles[variant])}>
      Кнопка
    </button>
  )
}
```

### 🏗️ Архитектурные стандарты

#### Компонентная структура
Следовать единой структуре компонентов:

```typescript
// ✅ Хорошо - четкая структура
interface Props {
  article: Article
  onEdit?: (id: string) => void
}

export function ArticleCard({ article, onEdit }: Props) {
  return (
    <div class={styles.card}>
      <h2>{article.title}</h2>
      <p>{article.excerpt}</p>
      {onEdit && (
        <button onClick={() => onEdit(article.id)}>
          Редактировать
        </button>
      )}
    </div>
  )
}
```

#### Контексты и провайдеры
Правильно организовывать глобальное состояние:

```typescript
// ✅ Хорошо - типизированный контекст
interface FeedContextValue {
  articles: Article[]
  loading: boolean
  error?: Error
  loadMore: () => Promise<void>
}

const FeedContext = createContext<FeedContextValue>()
```

### 🔒 Безопасность

#### Валидация данных
Проверять все входные данные:

```typescript
// ✅ Хорошо - валидация на клиенте и сервере
const createArticle = async (data: ArticleInput) => {
  // Клиентская валидация
  if (!data.title?.trim()) {
    throw new Error('Заголовок обязателен')
  }

  if (data.title.length > 200) {
    throw new Error('Заголовок слишком длинный')
  }

  // Серверная валидация через GraphQL
  const result = await client.mutation(CREATE_ARTICLE, { data })
  return result.data
}
```

#### XSS защита
Экранировать пользовательский контент:

```typescript
// ✅ Хорошо - безопасное отображение
function Comment({ text }: { text: string }) {
  // Экранируем HTML в тексте комментария
  const safeText = () => DOMPurify.sanitize(text)

  return <div innerHTML={safeText()} />
}
```

### 🌍 Интернационализация

#### Структура переводов
Организовывать переводы по функциональности:

```typescript
// src/intl/locales/ru/common.json
{
  "buttons": {
    "save": "Сохранить",
    "cancel": "Отмена",
    "delete": "Удалить"
  },
  "messages": {
    "loading": "Загрузка...",
    "error": "Ошибка"
  }
}

// src/intl/locales/en/common.json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "messages": {
    "loading": "Loading...",
    "error": "Error"
  }
}
```

#### Использование переводов
Правильно использовать i18next:

```typescript
// ✅ Хорошо - типизированные переводы
import { useLocalize } from '~/context/localize'

function Component() {
  const { t } = useLocalize()

  return (
    <div>
      <h1>{t('common.title')}</h1>
      <button>{t('buttons.save')}</button>
    </div>
  )
}
```

### 🧪 Тестирование

#### Структура тестов
Организовывать тесты по функциональности:

```
tests/
├── e2e/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── registration.spec.ts
│   ├── feed/
│   │   ├── feed-display.spec.ts
│   │   └── pagination.spec.ts
│   └── editor/
│       └── editor.spec.ts
```

#### Написание тестов
Следовать AAA паттерну:

```typescript
// ✅ Хорошо - четкая структура теста
test('должен отображать список статей', async () => {
  // Arrange - подготовка данных
  const mockArticles = [/* ... */]

  // Act - выполнение действия
  render(<FeedView articles={mockArticles} />)

  // Assert - проверка результата
  expect(screen.getByText('Статья 1')).toBeInTheDocument()
})
```

### 📝 Документирование

#### Комментарии в коде
Добавлять комментарии для сложной логики:

```typescript
// ✅ Хорошо - объяснение бизнес-логики
/**
 * Вычисляет популярность статьи на основе просмотров и лайков.
 * Формула: (просмотры * 0.3) + (лайки * 0.7)
 */
const calculatePopularity = (views: number, likes: number): number => {
  return (views * 0.3) + (likes * 0.7)
}
```

#### JSDoc для функций
Документировать публичные API:

```typescript
/**
 * Загружает статьи с учетом фильтров и пагинации
 * @param options - параметры загрузки
 * @returns Promise с массивом статей
 */
export const loadArticles = async (options: LoadOptions): Promise<Article[]> => {
  // реализация
}
```

### 🚀 Производительность

#### Оптимизации
Избегать ненужных операций:

```typescript
// ✅ Хорошо - мемоизация тяжелых вычислений
const expensiveCalculation = createMemo(() => {
  return items().filter(item => item.active).map(item => item.value)
})

// ✅ Хорошо - условное выполнение эффектов
createEffect(() => {
  if (data()) {
    // выполняем только когда данные загружены
    updateUI()
  }
})
```

#### Избегать антипаттернов
Не создавать лишние эффекты и сигналы:

```typescript
// ❌ Плохо - лишние сигналы
const [count, setCount] = createSignal(0)
const [doubleCount, setDoubleCount] = createSignal(0)

createEffect(() => {
  setDoubleCount(count() * 2) // можно заменить на createMemo
})

// ✅ Хорошо - мемоизация
const doubleCount = createMemo(() => count() * 2)
```

### 🔧 Инструменты

#### Автоматическая проверка
```bash
npm run typecheck   # Проверка TypeScript
npm run lint        # Линтинг Biome
npm run format      # Форматирование
npm run fix         # Автоисправление
```

#### Предварительная проверка
```bash
npm run check       # Полная проверка перед коммитом
npm run e2e:tests   # E2E тесты
```

## 📋 Чек-лист качества

### Перед коммитом
- [ ] Код компилируется без ошибок
- [ ] Все типы проверены
- [ ] Линтинг пройден
- [ ] Форматирование применено
- [ ] Тесты проходят

### Перед Pull Request
- [ ] Функциональность протестирована
- [ ] Документация обновлена
- [ ] Code review получен
- [ ] Критические баги исправлены

### Перед релизом
- [ ] Все тесты проходят
- [ ] Производительность в норме
- [ ] Безопасность проверена
- [ ] Документация актуальна
