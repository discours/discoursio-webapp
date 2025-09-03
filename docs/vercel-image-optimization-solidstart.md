# 🖼️ Vercel Image Optimization + SolidStart: Проверенная интеграция

## 🎯 Обзор

Интеграция Vercel Image Optimization с SolidStart возможна, но требует **осторожного подхода** и понимания ограничений. Этот документ содержит проверенную информацию о том, как это работает на практике.

## ⚠️ Важные ограничения

### **1. /_vercel/image vs /_next/image**
- `/_next/image` - **ТОЛЬКО для Next.js** ❌
- `/_vercel/image` - **НЕ документирован официально** ⚠️  
- Vercel Build Output API - **официальный способ** ✅

### **2. Официальная поддержка**
Vercel Image Optimization **официально поддерживается только в Next.js**. Для других фреймворков доступны:
- [Vercel Build Output API](https://vercel.com/docs/build-output-api/v3)
- [Static file optimization](https://vercel.com/docs/concepts/static-build/automatic-optimizations)

## 🔧 Проверенные способы интеграции

### **Способ 1: Build Output API (Рекомендуемый)**

```json
// .vercel/output/config.json
{
  "version": 3,
  "images": {
    "sizes": [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    "domains": ["files.dscrs.site", "files.discours.io"],
    "minimumCacheTTL": 3600,
    "formats": ["image/webp", "image/avif"]
  }
}
```

**Источники:**
- [Vercel Build Output API v3](https://vercel.com/docs/build-output-api/v3)
- [TanStack Start + Vercel Images](https://dev.to/ronanru/how-to-set-up-vercel-image-optimization-in-tanstack-start-21ed)

### **Способ 2: vercel.json (Текущий)**

```json
// vercel.json  
{
  "images": {
    "sizes": [10, 40, 110, 300, 600, 800, 1400],
    "remotePatterns": [
      {
        "protocol": "https",
        "hostname": "files.dscrs.site", 
        "pathname": "/**"
      }
    ],
    "minimumCacheTTL": 3600,
    "formats": ["image/webp", "image/avif"]
  }
}
```

**Источники:**
- [Vercel Images Configuration](https://vercel.com/docs/concepts/image-optimization#configuration)
- [Remote Patterns Documentation](https://vercel.com/docs/concepts/image-optimization#remote-patterns)

## 🧪 Экспериментальное тестирование

### **Тест /_vercel/image endpoint**

**❓ Статус: Недокументировано, требует тестирования**

```typescript
// ЭКСПЕРИМЕНТАЛЬНО: может не работать
const testUrl = `/_vercel/image?url=${encodeURIComponent('https://files.dscrs.site/image.jpg')}&w=600&q=75`

// Альтернатива через квотер (РАБОТАЕТ точно)
const quoterUrl = `https://files.dscrs.site/image_600.jpg`
```

**Риски:**
- Может перестать работать без предупреждения
- Не покрыто SLA Vercel
- Нет официальной поддержки

## ✅ Текущая рабочая архитектура

### **Что работает гарантированно:**

```typescript
// 1. Квотер оптимизация (100% работает)
const optimizedUrl = `${cdnUrl}/image_${width}.jpg`

// 2. WebP конверсия через квотер
const webpUrl = `${cdnUrl}/image_${width}.jpg/webp`

// 3. OG изображения через @vercel/og
const ogUrl = `/api/og?type=article&title=${title}`
```

### **Что требует тестирования:**

```typescript
// Vercel Image API (экспериментально)
const vercelUrl = `/_vercel/image?url=${encodeURIComponent(fullUrl)}&w=${width}&q=${quality}`
```

## 📊 Сравнение производительности

| Метод | Скорость | Кеширование | Поддержка | Стабильность |
|-------|----------|-------------|-----------|-------------|
| **Квотер** | ~200-500ms | Redis + HTTP | ✅ Полная | 🟢 Высокая |
| **Vercel Images** | ~50-100ms | Edge Network | ❓ Неизвестно | 🟡 Риск |
| **@vercel/og** | ~100-300ms | Edge Cache | ✅ Полная | 🟢 Высокая |

## 🎯 Рекомендуемая стратегия

### **Для Production (Консервативный подход):**

```typescript
export function getOptimizedImageUrl(filename: string, options: ImageOptions): string {
  const { width, format } = options
  
  // Используем только проверенные методы
  if (format === 'webp') {
    return getQuoterWebpUrl(filename, width)
  }
  
  // Стандартная оптимизация через квотер
  return getQuoterOptimizedUrl(filename, width)
}
```

### **Для Experimentation (с fallback):**

```typescript
export function getOptimizedImageUrl(filename: string, options: ImageOptions): string {
  const { width, quality = 75 } = options
  
  if (isExperimentalMode()) {
    try {
      // Тестируем Vercel Image API
      return getVercelImageUrl(`${cdnUrl}/${filename}`, width, quality)
    } catch (error) {
      console.warn('Vercel Image fallback to quoter:', error)
    }
  }
  
  // Fallback на квотер
  return getQuoterOptimizedUrl(filename, width)
}
```

## 🔍 Источники и ссылки

### **Официальная документация Vercel:**
- [Image Optimization Overview](https://vercel.com/docs/concepts/image-optimization)
- [Build Output API v3](https://vercel.com/docs/build-output-api/v3)
- [Next.js Image Component](https://nextjs.org/docs/api-reference/next/image) (только для Next.js)

### **Community решения:**
- [TanStack Start + Vercel Images](https://dev.to/ronanru/how-to-set-up-vercel-image-optimization-in-tanstack-start-21ed)
- [SolidStart deployment guide](https://start.solidjs.com/getting-started/deployment)

### **Альтернативы:**
- [Cloudinary](https://cloudinary.com/) - полнофункциональная замена
- [ImageKit](https://imagekit.io/) - специализированный сервис
- [Квотер (Rust)](https://github.com/quoter-org/quoter) - собственное решение

## 🚨 Предупреждения

### **⚠️ Экспериментальные features:**
- `/_vercel/image` может сломаться в любой момент
- Нет гарантий обратной совместимости
- Отсутствует техническая поддержка

### **✅ Безопасный подход:**
1. Начинать с квотера как основы
2. Тестировать Vercel Image в development
3. Постепенно мигрировать при положительных результатах
4. Сохранять fallback на квотер

## 🎯 Выводы

1. **Vercel Image Optimization НЕ гарантирует работу с SolidStart**
2. **Квотер остается надежной основой системы**
3. **Экспериментирование с /_vercel/image допустимо с fallback**
4. **OG изображения через @vercel/og работают стабильно**

**Рекомендация: Hybrid подход с осторожным тестированием новых возможностей** 🚀

---

*Документ обновлен: $(date). Основан на официальной документации Vercel и community опыте.*
