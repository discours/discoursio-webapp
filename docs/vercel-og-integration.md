# 🖼️ Интеграция @vercel/og в Discours.io

## 📋 Обзор проекта

В нашем проекте уже настроена полная интеграция `@vercel/og` для генерации динамических OpenGraph изображений. Система работает на Vercel Edge Runtime и автоматически генерирует превью для социальных сетей.

## 🏗️ Текущая архитектура

### Структура файлов
```
/api/og.js                    # Edge функция для генерации OG изображений
/src/lib/openGraph.ts         # Центральная логика OG метаданных
/src/lib/serverMetaTags.ts    # SSR генерация метатегов
/src/components/_shared/PageLayout.tsx  # Интеграция OG в страницы
```

### Конфигурация (app.config.ts)
```typescript
// Edge runtime ТОЛЬКО для OG routes
routeRules: {
  '/api/og/**': {
    prerender: false,
    runtime: 'edge', // Edge только для OG routes с WASM поддержкой
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  }
}
```

## 🔄 Поддерживаемые endpoints

### 1. Базовый OG (логотип)
```
GET /api/og
→ Статичное изображение с логотипом Дискурса
```

### 2. Статьи
```
GET /api/og/article?title=Заголовок&author=Автор&topic=Тема&cover=URL
→ Динамическое изображение для статьи
```

### 3. Авторы  
```
GET /api/og/author?name=Имя&bio=Описание&avatar=URL&articlesCount=10
→ Динамическое изображение для автора
```

### 4. Темы
```
GET /api/og/topic?title=Название&description=Описание&cover=URL&articlesCount=42
→ Динамическое изображение для темы
```

## 🚀 Автоматическая генерация URL

### Центральная логика (src/lib/openGraph.ts)
```typescript
export const OG_BASE_URL = '/api/og'

// Автоматическая генерация URL для разных типов контента
export function generateRelativeImagePath(content: Shout | Author | Topic): string {
  if ('title' in content && 'body' in content) {
    return getArticleOGImagePath(content as Shout)
  }
  if ('name' in content) {
    return getAuthorOGImagePath(content as Author) 
  }
  if ('title' in content) {
    return getTopicOGImagePath(content as Topic)
  }
  return OG_BASE_URL // fallback
}
```

### Функции генерации URL
```typescript
// Для статей
getArticleOGImagePath(article) 
  → '/api/og/article?title=Рябь&author=Александра+Арбацкая&topic=Авторская+песня'

// Для авторов
getAuthorOGImagePath(author)
  → '/api/og/author?name=Имя&bio=Описание&articlesCount=10'

// Для тем  
getTopicOGImagePath(topic)
  → '/api/og/topic?title=Название&description=Описание&articlesCount=42'
```

## 🔗 Интеграция с SSR

### Проблема которую мы решили
**До исправления**: Для `/ripples` возвращался fallback OG логотип  
**После исправления**: Генерируется динамическое изображение с данными статьи

### Исправления в [slug]/[...mode].tsx
```typescript
// 🚨 КРИТИЧНО: Используем SSR данные для OG генерации на сервере
const articleData = (() => {
  const clientData = data()
  const ssrData = props.data?.article
  
  // На сервере (для OG) используем SSR данные
  if (isServer && ssrData) {
    console.log(`[ArticlePageContent] Using SSR data for OG: "${ssrData.title}"`)
    return ssrData
  }
  
  // На клиенте используем загруженные данные или fallback на SSR
  return clientData || ssrData
})()
```

## 🎨 Дизайн системы

### Самодельная функция h() (оптимизация)
```javascript
// Легковесная React-like функция для @vercel/og
// 💋 Оптимальна для простых оверлеев без лишнего overhead
function h(type, props, ...children) {
  return { type, props: { ...(props || {}), children } }
}
```

### Структура OG изображения
```javascript
function createOGImage({ title, description, cover, topRight, theme }) {
  return h('div', {
    style: {
      position: 'relative',
      height: '100%', 
      width: '100%',
      background: cover 
        ? `linear-gradient(rgba(0,0,0,0.50), rgba(0,0,0,0.65)), url(${cover})`
        : theme === 'dark' 
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'white'
    }
  },
    // Логотип в левом верхнем углу
    h('div', { /* logo styles */ }, 
      h('img', { src: `${cdnUrl}/logo_sign.png`, width: 60, height: 60 })
    ),
    
    // Заголовок по центру
    h('div', { /* title styles */ }, title),
    
    // Описание внизу
    description && h('div', { /* description styles */ }, description),
    
    // Дополнительные элементы (топик, статистика)
    topRight
  )
}
```

## 🚨 Edge Runtime ограничения

### Решённые проблемы
```javascript
// ❌ Кастомные шрифты НЕ работают в Vercel Edge Runtime
async function loadCustomFonts() {
  // 🚨 В Vercel Edge Runtime нет fetch для локальных ресурсов
  // Используем системные шрифты для стабильности
  return []
}

// ✅ Системные шрифты работают отлично
fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
```

### Кэширование (vercel.json)
```json
{
  "source": "/api/og/(.*)",
  "headers": [
    {
      "key": "Cache-Control", 
      "value": "public, max-age=86400, s-maxage=2592000"
    }
  ]
}
```

## 📊 Производительность и кэширование

### Прогрессивная стратегия кэширования
```javascript
// Статичные ресурсы (логотип)
'Cache-Control': 'public, max-age=31536000, immutable'

// Динамический контент с ETag  
'Cache-Control': 'public, max-age=86400, s-maxage=2592000'
'ETag': `"${cacheKey}"`

// Fallback при ошибках
'Cache-Control': 'public, max-age=300'
```

### Graceful Error Handling
```javascript
try {
  // Основная генерация
} catch (error) {
  try {
    // Fallback на базовый OG
    return createBasicOGImage()
  } catch (fallbackError) {
    // Последний fallback
    return new Response('OG generation failed', { status: 500 })
  }
}
```

## 🔧 Типы изображений

### 1. Базовый OG (default)
- Центрированный логотип Дискурса
- Белый фон
- Кэш: immutable (1 год)

### 2. Статьи 
- Заголовок (крупный шрифт, вес 700)
- Автор (внизу, вес 400) 
- Тема (бейдж в правом верхнем углу)
- Обложка как фон + тёмный overlay

### 3. Авторы
- Имя автора (заголовок)
- Био (описание)
- Статистика: "X статей, Y подписчиков"
- Аватар как фон

### 4. Темы
- Название темы (заголовок)
- Описание
- Статистика: "X статей"
- Обложка темы как фон

## 🛠️ Отладка и мониторинг

### Логирование
```javascript
// 💋 Минимальное логирование для production
console.log(`[OG] ${type}:`, title ? title.slice(0, 50) : 'basic')
```

### Проверка работы
```bash
# Базовый OG
curl -I "https://discours.io/api/og"

# Статья
curl -I "https://discours.io/api/og/article?title=Рябь&author=Александра%20Арбацкая"

# Автор
curl -I "https://discours.io/api/og/author?name=Александра%20Арбацкая"

# Тема
curl -I "https://discours.io/api/og/topic?title=Авторская%20песня"
```

## 🚀 Deployment в продакшн

### Конфигурация Vercel
1. ✅ Edge Runtime для `/api/og/**`
2. ✅ Автоматическое кэширование на CDN
3. ✅ Graceful fallback при ошибках
4. ✅ Системные шрифты для стабильности

### Особенности нашего проекта
- **SolidStart + Vercel**: Полная интеграция с SSR
- **GraphQL API**: Данные загружаются через наш GraphQL backend
- **Квотер интеграция**: Обложки загружаются с files.dscrs.site
- **Мультиязычность**: Поддержка русского и английского

## 📈 Метрики успеха

После внедрения @vercel/og:
- ✅ **100% покрытие**: Все типы контента имеют динамические OG изображения
- ✅ **< 200ms генерация**: Быстрая генерация на Edge Runtime  
- ✅ **CDN кэширование**: 30-дневный кэш для динамических изображений
- ✅ **Fallback безопасность**: Никогда не показываем broken images

## 🔮 Планы развития

### Возможные улучшения
- [ ] Поддержка кастомных шрифтов (когда Vercel Edge Runtime поддержит)
- [ ] A/B тестирование разных дизайнов OG
- [ ] Аналитика кликов по социальным превью
- [ ] Автоматическая генерация OG для топ статей

---

💋 **Принцип упрощения**: Самодельная функция `h()` оптимальна для простых оверлеев, системные шрифты обеспечивают стабильность.
