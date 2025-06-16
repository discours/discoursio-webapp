# Система кеширования изображений

## Обзор

Система кеширования изображений в проекте построена на многоуровневой архитектуре, обеспечивающей оптимальную производительность и надежность загрузки изображений. Система включает в себя кеширование на уровне браузера, CDN, middleware и обработку ошибок с fallback на заглушки.

## Архитектура системы

### 1. Компоненты системы

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Image.tsx     │───▶│  imageCache.ts   │───▶│  middleware.js  │
│ (UI компонент)  │    │ (URL генерация)  │    │ (HTTP headers)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  CoverImage     │    │   vercel.json    │    │ api/purge-cache │
│  (заглушки)     │    │ (CDN настройки)  │    │ (очистка кеша)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 2. Флоу обработки изображений

```mermaid
graph TD
    A[Запрос изображения] --> B[Image.tsx]
    B --> C[getCachedImageUrl()]
    C --> D{Внешний URL?}
    D -->|Да| E[Добавить CDN + параметры]
    D -->|Нет| F[Локальный ресурс]
    E --> G[middleware.js]
    G --> H{Есть параметр v?}
    H -->|Да| I[no-cache headers]
    H -->|Нет| J[cache headers 1h]
    I --> K[Загрузка изображения]
    J --> K
    K --> L{Успех?}
    L -->|Да| M[Отображение]
    L -->|Нет| N[handleImageError]
    N --> O{Попытка < 2?}
    O -->|Да| P[Retry с параметром]
    O -->|Нет| Q[onError callback]
    P --> K
    Q --> R[CoverImage заглушка]
```

## Детальное описание компонентов

### 1. Image.tsx - Основной компонент изображений

**Назначение**: Отображение изображений с обработкой ошибок и кешированием

**Ключевые особенности**:
- Автоматическое использование кешированных URL
- Обработка ошибок с повторными попытками (максимум 2)
- Корректный вызов callback `onError` для показа заглушек
- Отслеживание состояния загрузки и ошибок

**Пример использования**:
```tsx
<Image 
  src="https://example.com/image.jpg"
  alt="Описание изображения"
  width={400}
  onError={() => setShowPlaceholder(true)}
  onLoad={() => setImageLoaded(true)}
/>
```

**Логика обработки ошибок**:
```typescript
const handleImageError = () => {
  const currentRetries = retries()
  
  if (currentRetries < 1) {
    // Повторная попытка с параметром retry
    setRetries(currentRetries + 1)
  } else {
    // Вызов callback родительского компонента
    setHasError(true)
    local.onError?.(event as any)
  }
}
```

### 2. imageCache.ts - Генерация URL с кешированием

**Назначение**: Генерация URL изображений с параметрами для управления кешированием

**Ключевые функции**:

#### `getCachedImageUrl(src, options)`
Генерирует URL изображения с параметрами кеширования:

```typescript
export const getCachedImageUrl = (
  src: string,
  options: { width?: number; shout?: string | number } = {}
): string => {
  if (!src) return ''

  // Генерируем базовый URL
  const parts = src.split('.')
  const extension = parts.pop() || ''
  let filepath = parts.join('.')
  
  if (options.width) {
    filepath = `${filepath}_${options.width}`
  }
  
  const basename = filepath.split('/').pop() || ''

  // Формируем URL с путем к CDN
  const cdnPath = `${cdnUrl}/unsafe/plain/${src}`
  
  // Добавляем параметры
  const params = new URLSearchParams()
  params.set('v', CACHE_VERSION) // Фиксированная версия кеша
  
  if (options.shout) {
    params.set('s', String(options.shout))
  }

  return `${cdnPath}?${params.toString()}`
}
```

#### `getCachedImageSrcSet(src, widths)`
Генерирует srcSet для адаптивных изображений:

```typescript
export const getCachedImageSrcSet = (
  src: string, 
  widths: number[] = [400, 800, 1200]
): string => {
  return widths
    .map(width => `${getCachedImageUrl(src, { width })} ${width}w`)
    .join(', ')
}
```

**Параметры URL**:
- `v` - версия кеша (константа `CACHE_VERSION = '1.0.0'`)
- `s` - shout ID для связи с публикацией
- `retry` - параметр для повторных попыток (добавляется автоматически)

### 3. middleware.js - HTTP заголовки кеширования

**Назначение**: Управление заголовками кеширования на уровне HTTP

**Логика работы**:
```javascript
export default function middleware(request) {
  const url = new URL(request.url)

  // Обрабатываем только изображения
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
    const response = new Response(null, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'CDN-Cache-Control': 'public, max-age=31536000'
      }
    })

    // Если есть параметр версии или retry - обходим кеш
    if (url.searchParams.has('v') || url.searchParams.has('retry')) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      response.headers.set('CDN-Cache-Control', 'no-cache')
    }

    return response
  }

  return null
}
```

**Стратегии кеширования**:
- **Обычные изображения**: кеш 1 час, stale-while-revalidate 24 часа
- **CDN кеш**: 1 год для статических ресурсов
- **С параметрами v/retry**: полное отключение кеша

### 4. vercel.json - Конфигурация CDN

**Назначение**: Настройка правил кеширования на уровне Vercel CDN

**Основные правила**:
```json
{
  "headers": [
    {
      "source": "/(.*\\.(jpg|jpeg|png|gif|webp|svg|ico))",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, stale-while-revalidate=86400"
        },
        {
          "key": "CDN-Cache-Control", 
          "value": "public, max-age=31536000"
        }
      ]
    },
    {
      "source": "/(.*\\.(jpg|jpeg|png|gif|webp|svg|ico))\\?.*[&?]v=.*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

### 5. api/purge-cache.js - Очистка кеша

**Назначение**: API для принудительной очистки кеша изображений

**Функциональность**:
- Очистка кеша Vercel через API
- Cron-задача для автоматической очистки каждые 6 часов
- Ручная очистка через HTTP запрос

## Обработка ошибок и заглушки

### Система fallback

1. **Первая попытка**: Загрузка оригинального URL
2. **Вторая попытка**: Загрузка с параметром `retry=1`
3. **Fallback**: Показ заглушки через `CoverImage`

### CoverImage - Компонент заглушек

**Типы заглушек**:
- Треугольная заглушка для статей
- Цветные заглушки для разных категорий
- Адаптивные размеры

**Пример использования**:
```tsx
<Show when={isCoverImageLoadError()} fallback={
  <Image 
    src={article.cover} 
    onError={() => setIsCoverImageLoadError(true)}
  />
}>
  <CoverImage article={article} />
</Show>
```

## Оптимизация производительности

### 1. Кеширование на разных уровнях

- **Браузер**: 1 час с stale-while-revalidate 24 часа
- **CDN**: 1 год для статических ресурсов
- **Service Worker**: Дополнительное кеширование для offline

### 2. Адаптивные изображения

```typescript
// Генерация srcSet для разных разрешений
const srcSet = getCachedImageSrcSet(imageSrc, [400, 800, 1200])

<img 
  src={getCachedImageUrl(imageSrc, { width: 800 })}
  srcSet={srcSet}
  sizes="(max-width: 768px) 400px, (max-width: 1200px) 800px, 1200px"
/>
```

### 3. Предзагрузка критических изображений

```tsx
// В компоненте Image
const preloadUrl = () => {
  if (local.src && local.src.startsWith('http')) {
    return getCachedImageUrl(local.src, { width: others.width })
  }
  return local.src
}

// Preload link в head
<Link rel="preload" as="image" href={preloadUrl()} />
```

## Диагностика и отладка

### Логирование

Система включает подробное логирование для диагностики:

```typescript
// В Image.tsx
console.log('Image loading:', {
  src: local.src,
  cachedUrl: imageUrl(),
  retries: retries(),
  hasError: hasError()
})

// В imageCache.ts
console.log('Generated cached URL:', {
  original: src,
  cached: finalUrl,
  params: Object.fromEntries(params)
})
```

### Проверка кеша

Для проверки работы кеширования:

1. Откройте DevTools → Network
2. Загрузите страницу с изображениями
3. Проверьте заголовки ответа:
   - `Cache-Control`
   - `CDN-Cache-Control`
   - `Age` (для кешированных ресурсов)

### Принудительное обновление

Для принудительного обновления изображения:

```typescript
// Изменить версию кеша в imageCache.ts
const CACHE_VERSION = '1.0.1' // Увеличить версию

// Или использовать API очистки кеша
fetch('/api/purge-cache', { method: 'POST' })
```

## Лучшие практики

### 1. Использование компонента Image

```tsx
// ✅ Правильно
<Image 
  src={imageSrc}
  alt="Описательный текст"
  width={400}
  onError={() => setShowPlaceholder(true)}
/>

// ❌ Неправильно - прямое использование img
<img src={imageSrc} alt="..." />
```

### 2. Обработка состояний загрузки

```tsx
const [imageLoaded, setImageLoaded] = createSignal(false)
const [imageError, setImageError] = createSignal(false)

<Show 
  when={!imageError()} 
  fallback={<CoverImage />}
>
  <Image 
    src={imageSrc}
    onLoad={() => setImageLoaded(true)}
    onError={() => setImageError(true)}
    class={imageLoaded() ? 'loaded' : 'loading'}
  />
</Show>
```

### 3. Оптимизация для мобильных устройств

```tsx
// Использование разных размеров для разных устройств
const mobileWidth = 400
const desktopWidth = 800

<Image 
  src={getCachedImageUrl(imageSrc, { 
    width: window.innerWidth < 768 ? mobileWidth : desktopWidth 
  })}
  srcSet={getCachedImageSrcSet(imageSrc, [400, 800, 1200])}
  sizes="(max-width: 768px) 400px, 800px"
/>
```

## Устранение неполадок

### Проблема: Изображения не кешируются

**Решение**:
1. Проверьте параметры URL - не должно быть лишних параметров
2. Убедитесь, что middleware.js корректно обрабатывает запросы
3. Проверьте настройки vercel.json

### Проблема: Заглушки показываются вместо изображений

**Решение**:
1. Проверьте корректность URL изображений
2. Убедитесь, что callback `onError` вызывается правильно
3. Проверьте логику в `handleImageError`

### Проблема: Медленная загрузка изображений

**Решение**:
1. Используйте адаптивные изображения с srcSet
2. Добавьте preload для критических изображений
3. Оптимизируйте размеры изображений на сервере

## Заключение

Система кеширования изображений обеспечивает:
- **Высокую производительность** через многоуровневое кеширование
- **Надежность** через систему fallback и обработку ошибок  
- **Гибкость** через параметризованные URL и адаптивные изображения
- **Простоту использования** через единый компонент Image

Система автоматически обрабатывает большинство сценариев использования и предоставляет инструменты для диагностики и оптимизации производительности. 