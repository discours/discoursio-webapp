# Стратегия метатегов: Решение проблем @solidjs/meta с SSR

## 🎯 Анализ проблемы

[Unverified] На июнь 2025 года `@solidjs/meta` имеет критические проблемы с Server-Side Rendering:

- **Issue #54**: Комбинация символов `$'` ломает серверный рендеринг
- **Issue #33**: Resource в title рендерится как `[object Object]` 
- **Issue #29**: Отсутствует функция `renderTags()` для SSR
- **Issue #28**: Ошибки гидратации при использовании `<Meta />` в SolidStart

## 🏗️ Архитектура решения

### Двухуровневый подход

1. **SSR уровень** (`entry-server.tsx`) - переводимые метатеги в HTML
2. **CSR уровень** (`PageLayout.tsx`) - динамические обновления DOM API

## 📁 Структура файлов

```
src/
├── lib/
│   ├── serverMetaTags.ts          # Генератор метатегов для сервера
│   └── openGraph.ts               # Существующая система OG метаданных
├── components/_shared/
│   └── PageLayout.tsx             # Обновленный компонент с прямым DOM API
├── entry-server.tsx               # Базовые метатеги для SSR
└── intl/
    └── keywords.ts                # Система переводимых ключевых слов
```

## 🔧 Компоненты решения

### 1. Серверная часть (`entry-server.tsx`)

**Основные принципы:**
- Базовые метатеги рендерятся на сервере
- Минимум логики для избежания ошибок SSR
- Переводимые тексты через `useLocalize()`

```tsx
// Базовые метатеги в <head>
<title>{t('Discours')}</title>
<meta name="description" content={t('Discours – an open magazine about culture, science and society')} />
<meta property="og:title" content={t('Discours')} />
<meta property="og:image" content="https://files.dscrs.site/production/image/logo_image.png" />
```

### 2. Клиентская часть (`PageLayout.tsx`)

**Принципы обновления метатегов:**
- Прямое DOM API вместо `@solidjs/meta`
- Реактивные обновления через `createMemo()`
- Централизованная логика в `updateServerMetaTags()`

```tsx
// Обновление метатегов напрямую в DOM
function updateServerMetaTags(ogMetadata, keywords) {
  if (isServer) return // На сервере только базовые теги
  
  // Обновляем/создаем метатеги
  const updateMetaTag = (selector, content) => {
    let meta = document.querySelector(selector)
    if (!meta) {
      meta = document.createElement('meta')
      // Парсим атрибут из селектора
      if (selector.includes('property=')) {
        const property = selector.match(/property="([^"]+)"/)?.[1]
        if (property) meta.setAttribute('property', property)
      } else if (selector.includes('name=')) {
        const name = selector.match(/name="([^"]+)"/)?.[1]
        if (name) meta.setAttribute('name', name)
      }
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', content)
  }
  
  updateMetaTag('meta[name="description"]', ogMetadata.description)
  updateMetaTag('meta[property="og:title"]', ogMetadata.title)
  // ... остальные теги
}
```

### 3. Универсальный генератор (`serverMetaTags.ts`)

**Возможности:**
- Генерация всех типов метатегов из единого источника
- Переиспользование логики `openGraph.ts` и `keywords.ts`  
- Безопасное экранирование HTML
- Поддержка статей, авторов, тем

```tsx
export function generateServerMetaTags(contentData, options) {
  const ogMetadata = generateOGMetadata(contentData, options)
  const keywords = getPageKeywords(contentInfo, pathname, locale)
  
  return `
    <title>${escapeHtml(ogMetadata.title)}</title>
    <meta name="description" content="${escapeHtml(ogMetadata.description)}" />
    <meta property="og:type" content="${escapeHtml(ogMetadata.type)}" />
    <!-- ... остальные метатеги ... -->
  `
}
```

## 🌐 Поддержка многоязычности

### Переводимые метатеги

Все тексты метатегов переводимы через систему `useLocalize()`:

```tsx
// Заголовки
t('Discours') // -> "Дискурс" | "Discours"

// Описания  
t('Discours – an open magazine about culture, science and society')
// -> "Дискурс – открытый журнал о культуре, науке и обществе"

// Ключевые слова
t('keywords') // -> из intl/locales/{ru|en}/keywords.json
```

### Система ключевых слов

Централизованная система в `intl/keywords.ts` с поддержкой:

- **Статических страниц**: `home`, `feed`, `authors`, `topics`
- **Динамического контента**: `article`, `author`, `topic`
- **Автоматической подстановки** названий и тем
- **Fallback значений** для всех типов контента

## 🎨 Типы контента

### Статьи (`article`)

```tsx
<meta property="og:type" content="article" />
<meta property="article:author" content="Имя Автора" />
<meta property="article:section" content="Название Темы" />
<meta property="article:published_time" content="2024-01-01T00:00:00Z" />
<meta property="article:tag" content="тег1" />
<meta property="article:tag" content="тег2" />
```

### Авторы (`profile`)

```tsx
<meta property="og:type" content="profile" />
<meta property="profile:first_name" content="Имя" />
<meta property="profile:last_name" content="Фамилия" />
<meta property="profile:username" content="username" />
```

### Темы (`topic`)

```tsx
<meta property="og:type" content="website" />
<!-- + стандартные OG теги -->
```

## 🔗 Интеграция с OG-изображениями

### Динамические изображения

API `/api/og/` продолжает работать без изменений:

```tsx
// Статья
/api/og/article?title=Заголовок&author=Автор&topic=Тема&cover=URL

// Автор  
/api/og/author?name=Имя&bio=Описание&avatar=URL&articlesCount=10

// Тема
/api/og/topic?title=Название&description=Описание&cover=URL
```

### Автоматическая генерация URL

Модуль `openGraph.ts` автоматически генерирует правильные URL:

```tsx
const ogMetadata = generateOGMetadata(article, {
  pathname: '/article/my-slug',
  locale: 'ru'
})

// ogMetadata.image -> '/api/og/article?title=..&author=..&topic=..'
```

## 🚀 Преимущества решения

### ✅ Технические

- **Надежность SSR**: Без проблем `@solidjs/meta`
- **Производительность**: Минимальные DOM операции
- **Совместимость**: Работает с поисковыми системами и соцсетями
- **Переводимость**: Полная поддержка многоязычности
- **Расширяемость**: Легко добавлять новые типы метатегов

### ✅ Архитектурные

- **DRY принцип**: Переиспользование `openGraph.ts` и `keywords.ts`  
- **Централизация**: Единый источник правды для метаданных
- **Минимальные изменения**: Не нарушает существующий код
- **Обратная совместимость**: Существующие компоненты работают как прежде

## 📋 Использование

### В компонентах страниц

```tsx
<PageLayout
  title="Заголовок страницы"
  desc="Описание страницы"
  article={article} // или author={author} или topic={topic}
>
  {/* Контент страницы */}
</PageLayout>
```

### Для статей

```tsx
<PageLayout
  title={article.title}
  desc={article.subtitle}
  article={article}
>
  <FullArticle article={article} />
</PageLayout>
```

### Для авторов

```tsx
<PageLayout
  title={author.name}
  desc={author.bio}
  author={author}
>
  <AuthorView author={author} />
</PageLayout>
```

### Для тем

```tsx
<PageLayout
  title={topic.title}
  desc={topic.about}
  topic={topic}
>
  <TopicView topic={topic} />
</PageLayout>
```

## 🔍 Проверка работоспособности

### Инструменты для тестирования

1. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
2. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
3. **LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/
4. **WhatsApp Link Preview**: Просто отправьте ссылку в чате

### Что проверять

- ✅ Заголовок отображается корректно
- ✅ Описание присутствует и не обрезается
- ✅ Изображение загружается (1200x630)
- ✅ URL канонический и правильный
- ✅ Тип контента определен верно

## 🛠️ Миграция

### Шаг 1: Обновление существующих страниц

Все существующие `PageLayout` компоненты продолжают работать без изменений. Для улучшения SEO просто добавьте нужные пропсы:

```tsx
// Было
<PageLayout title="Статья">
  <FullArticle />
</PageLayout>

// Стало
<PageLayout title="Статья" article={article}>
  <FullArticle />
</PageLayout>
```

### Шаг 2: Проверка переводов

Убедитесь, что все необходимые ключи переводов есть в `intl/locales/*/translation.json`:

```json
{
  "Discours": "Дискурс",
  "Discours – an open magazine about culture, science and society": "Дискурс – открытый журнал о культуре, науке и обществе"
}
```

### Шаг 3: Тестирование

Протестируйте ключевые страницы в валидаторах социальных сетей.

## 🔮 Будущее

### Планы развития

Когда `@solidjs/meta` будет исправлен:

```tsx
// Будущая миграция
import { Meta } from '@solidjs/meta'

// Заменим прямое DOM API на компоненты
<Meta property="og:title" content={ogMetadata.title} />
<Meta property="og:description" content={ogMetadata.description} />
```

### Мониторинг исправлений

Следим за [RFC #2294](https://github.com/solidjs/solid/discussions/2294) - планируется встроенная поддержка метатегов в ядро Solid.

## ✅ Заключение

**Текущее решение обеспечивает:**
- ✅ Корректную работу метатегов в соцсетях
- ✅ Полную поддержку многоязычности
- ✅ Минимальные изменения в коде
- ✅ Производительность и безопасность
- ✅ Легкую миграцию в будущем

**Статус: Готово к использованию** 🚀 