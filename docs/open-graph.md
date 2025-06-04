# Open Graph и социальные сети

## Общие сведения

Open Graph (OG) протокол используется для оптимизации отображения контента при его публикации в социальных сетях. Наш проект реализует полную поддержку OG-тегов для трех основных типов контента:
- Статьи
- Авторы
- Темы

## Архитектура решения

Наш подход к OG-тегам состоит из двух основных компонентов:

1. **Мета-теги для страниц** - Генерируются в компоненте `PageLayout`
2. **Динамические OG-изображения** - Генерируются через API-эндпоинты `/api/og/*`

### Основные мета-теги

Для всех страниц добавляются следующие мета-теги:

```html
<meta property="og:type" content="article|profile|website" />
<meta property="og:title" content="..." />
<meta property="og:site_name" content="Discours" />
<meta property="og:description" content="..." />
<meta property="og:url" content="..." />
<meta property="og:image" content="/api/og/..." />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="ru|en" />
```

### Twitter Cards

Для лучшего отображения в Twitter также добавлены специальные мета-теги:

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@discoursio" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="/api/og/..." />
```

## Генерация динамических OG-изображений

Для генерации изображений проект использует библиотеку `@vercel/og`, которая позволяет создавать динамические OG-изображения на лету.

### Доступные API эндпоинты

| Эндпоинт | Описание | Параметры |
|----------|----------|-----------|
| `/api/og/article` | Изображение для статьи | title, author, topic, cover |
| `/api/og/author` | Изображение для автора | name, bio, avatar, articlesCount, followersCount |
| `/api/og/topic` | Изображение для темы | title, description, cover, articlesCount |
| `/api/og/basic` | Базовое изображение | (без параметров) |

### Как это работает

1. При рендеринге страницы компонент `PageLayout` определяет тип контента (статья/автор/тема)
2. На основе типа контента создается URL для OG-изображения с необходимыми параметрами
3. OG-изображение генерируется динамически при первом запросе и кэшируется на сервере
4. Полученный URL добавляется в мета-теги страницы

## Использование в коде

### PageLayout

Основная логика формирования OG-тегов реализована в компоненте `PageLayout`. 

```tsx
// Пример использования
<PageLayout
  title="Название статьи"
  desc="Описание статьи"
  article={articleData}
>
  {/* Содержимое страницы */}
</PageLayout>
```

Для авторов и тем используйте соответствующие пропсы:

```tsx
<PageLayout
  title="Профиль автора"
  author={authorData}
>
  {/* Содержимое страницы автора */}
</PageLayout>

<PageLayout
  title="Страница темы"
  topic={topicData}
>
  {/* Содержимое страницы темы */}
</PageLayout>
```

### Утилиты для генерации OG-изображений

Для случаев когда нужно получить URL OG-изображения вне компонента `PageLayout`, используйте утилиты из `src/lib/ogImages.ts`:

```ts
import { getArticleOGImage, getAuthorOGImage, getTopicOGImage } from '~/lib/ogImages'

// Для статьи
const articleOgUrl = getArticleOGImage(articleData)

// Для автора
const authorOgUrl = getAuthorOGImage(authorData)

// Для темы
const topicOgUrl = getTopicOGImage(topicData)
```

## Оптимизация мета-тегов

Для оптимальной работы OG-тегов следуйте этим правилам:

1. Всегда используйте абсолютные URL для `og:image`
2. Предпочитайте изображения с соотношением сторон 1.91:1 (1200×630 пикселей)
3. Убедитесь, что текст в OG-изображениях хорошо читабелен
4. Используйте правильные типы контента (`article` для статей, `profile` для авторов)
5. Поддерживайте соответствие между `og:title` и обычным `<title>` страницы

## Twitter Cards

Twitter использует свои собственные мета-теги, но также распознает Open Graph теги. В нашей реализации мы добавляем специальные Twitter Card теги для обеспечения наилучшего отображения в Twitter:

- `twitter:card` - тип карточки (используем `summary_large_image`)
- `twitter:site` - официальный аккаунт проекта
- `twitter:title` - заголовок (дублирует `og:title`)
- `twitter:description` - описание (дублирует `og:description`)
- `twitter:image` - URL изображения (дублирует `og:image`)

## Тестирование OG-тегов

Для проверки корректности OG-тегов можно использовать следующие инструменты:

- [Инструмент отладки Facebook](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
- [Open Graph Check](https://www.opengraph.xyz/) 