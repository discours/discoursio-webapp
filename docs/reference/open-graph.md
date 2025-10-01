# Open Graph и социальные сети

## Общие сведения

Open Graph (OG) протокол используется для оптимизации отображения контента при его публикации в социальных сетях. Наш проект реализует полную поддержку OG-тегов для трех основных типов контента:
- Статьи
- Авторы
- Темы

## Архитектура решения

Наш подход к OG-тегам состоит из трех основных компонентов:

1. **Централизованный модуль `openGraph.ts`** - Единый источник истины для всех OG-операций
2. **Мета-теги для страниц** - Генерируются в компоненте `PageLayout` через `generateOGMetadata()`
3. **Динамические OG-изображения** - Генерируются через API-эндпоинты `/api/og/*`

## Квотер оверлеи
НЕ ИСПОЛЬЗУЮТСЯ в текущей реализации:
```
# УСТАРЕЛО: https://files.dscrs.site/image/photo_640.jpg?s=12345
```

**Vercel OG API** генерирует превью для социальных сетей:
```
https://discours.io/api/og/article?title=...&author=...
```

### Правила использования

| Назначение | Технология | URL формат | Размер |
|-----------|-----------|-----------|--------|
| Изображения в статьях | Квотер (Rust) | `files.dscrs.site/image/name_640.jpg` | Любой |
| Превью для соцсетей | Vercel OG (JS) | `discours.io/api/og/article?title=...` | 1200x630 |

### Централизованный модуль openGraph.ts

Модуль `/src/lib/openGraph.ts` обеспечивает всю логику работы с Open Graph метатегами:

- Константы для стандартных значений (ширина, высота, имя сайта)
- Типизированные функции для извлечения данных из объектов (статьи, авторы, темы)
- Функция `generateOGMetadata()` для генерации всех OG-метатегов одним вызовом
- Функции для создания URL-адресов OG-изображений

```typescript
// Пример использования
import { generateOGMetadata } from '~/lib/openGraph'

// В компоненте
const ogMetadata = generateOGMetadata(article, {
  pathname: '/article/slug',
  locale: 'ru',
  defaultTitle: 'Заголовок по умолчанию'
})

// Все метаданные доступны через объект ogMetadata
console.log(ogMetadata.title)
console.log(ogMetadata.description)
console.log(ogMetadata.image)
```

### Основные мета-теги

Для всех страниц добавляются следующие мета-теги:

```html
<!-- Основные Open Graph теги -->
<meta property="og:type" content="article|profile|website" />
<meta property="og:title" content="..." />
<meta property="og:site_name" content="Discours" />
<meta property="og:description" content="..." />
<meta property="og:url" content="<base_url>" />
<meta property="og:image" content="<base_url>/api/og/..." />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="..." />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:secure_url" content="https://..." />
<meta property="og:locale" content="ru" />
<meta property="og:logo" content="<base_url>/logo_sign.png" />

<!-- Теги для статей -->
<meta property="article:author" content="Имя автора" />
<meta property="article:section" content="Раздел/тема" />
<meta property="article:published_time" content="2024-01-01T00:00:00.000Z" />
<meta property="article:modified_time" content="2024-01-01T00:00:00.000Z" />
<meta property="article:tag" content="тег1" />
<meta property="article:tag" content="тег2" />

<!-- Теги для профилей авторов -->
<meta property="profile:first_name" content="Имя" />
<meta property="profile:last_name" content="Фамилия" />
<meta property="profile:username" content="username" />

<!-- Twitter Card теги -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@discoursio" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="..." />
<meta name="twitter:image:alt" content="..." />

<!-- VK теги -->
<meta name="vk:title" content="..." />
<meta name="vk:description" content="..." />
<meta name="vk:image" content="..." />

<!-- Поисковые теги -->
<link rel="canonical" href="<canonical_url>" />
<meta name="robots" content="index, follow" />
```

### Динамические OG-изображения

Наше решение включает генерацию динамических OG-изображений для каждого типа контента:

- `/api/og/article` - Изображения для статей с заголовком, автором и темой
- `/api/og/author` - Изображения для авторов с именем, био и статистикой
- `/api/og/topic` - Изображения для тем с названием и описанием
- `/api/og/basic` - Базовое изображение с логотипом для других страниц

Эти эндпоинты используют библиотеку `@vercel/og` для генерации изображений на лету с учетом динамических данных.

## Использование OG-тегов

### В компонентах страниц

В `PageLayout.tsx` OG-теги генерируются автоматически на основе переданных props:

```tsx
<PageLayout
  title="Заголовок страницы"
  desc="Описание страницы"
  article={article} // или author={author} или topic={topic}
>
  {/* Контент страницы */}
</PageLayout>
```

### Для API-эндпоинтов

Динамические OG-изображения доступны по URL с параметрами:

```
/api/og/article?title=Заголовок&author=Имя%20Автора&topic=Тема&cover=URL
/api/og/author?name=Имя%20Автора&bio=Описание&avatar=URL
/api/og/topic?title=Название%20Темы&description=Описание&cover=URL
```

### Для прямого использования

Можно напрямую использовать функцию `generateOGMetadata`:

```typescript
import { generateOGMetadata } from '~/lib/openGraph'

const ogData = generateOGMetadata(content, {
  pathname: location.pathname,
  locale: 'ru'
})

// Используйте ogData.title, ogData.description и т.д.
```

## Рекомендации по работе с OG-тегами

1. **Не дублируйте логику** - используйте централизованный модуль `openGraph.ts`
2. **Абсолютные URL** - всегда используйте абсолютные URL для OG-изображений
3. **Описания** - оптимальная длина 140-160 символов
4. **Изображения** - оптимальный размер 1200x630 пикселей
5. **Тестирование** - проверяйте OG-теги через [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) или другие валидаторы 