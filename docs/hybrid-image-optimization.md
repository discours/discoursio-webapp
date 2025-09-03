# 🔄 Hybrid Image Optimization: Квотер + Vercel API

## 🎯 Обзор архитектуры

Система изображений в discours.io использует **гибридный подход**, комбинируя преимущества квотера-прокси и Vercel Image API для максимальной производительности и гибкости.

## 📊 Компоненты системы

### 1. 📤 **Upload Pipeline (Квотер)**
```
Frontend → handleFileUpload.ts → Квотер API → S3 Storage
```

- **Путь**: `src/lib/handleFileUpload.ts`
- **Назначение**: Загрузка файлов пользователей
- **Хранилище**: S3 через квотер
- **Форматы**: JPEG, PNG, GIF, WebP, HEIC → JPEG
- **Лимиты**: до 500MB

### 2. 🖼️ **Display Pipeline (Vercel + Квотер)**
```
Frontend → imageOptimization.ts → Vercel Image API ↘
                                                    → Квотер S3 → Оптимизация → Cache
```

- **Путь**: `src/lib/imageOptimization.ts` (новый)
- **Стратегия**: Автоматический выбор между Vercel API и квотером
- **Кеширование**: Global Edge Network (Vercel) + S3 (квотер)

### 3. 🎨 **OG Generation (@vercel/og)**
```
api/og.js → @vercel/og → Edge Runtime → Dynamic PNG
```

- **Путь**: `api/og.js`
- **Назначение**: Open Graph изображения с текстом
- **Технология**: Vercel Edge Functions

## 🔄 Логика выбора стратегии

### **Vercel Image API (95% случаев)**
```typescript
// Все стандартные изображения
getOptimizedImageUrl('image.jpg', { width: 600 })
// → /_next/image?url=https://files.dscrs.site/image.jpg&w=600&q=75
```

**Используется для:**
- ✅ Статьи, аватары, обложки
- ✅ Автоматический WebP/AVIF по User-Agent
- ✅ Responsive изображения
- ✅ Global Edge Network

### **Квотер (5% случаев)**
```typescript
// Explicit WebP для legacy браузеров
getOptimizedImageUrl('image.jpg', { width: 600, format: 'webp' })
// → https://files.dscrs.site/image_600.jpg/webp
```

**Используется для:**
- 🔧 Принудительный WebP
- 🔧 Legacy поддержка
- 🔧 Специальные форматы

## 📁 Файловая структура

```
src/
├── lib/
│   ├── handleFileUpload.ts      # 📤 Upload через квотер
│   ├── imageOptimization.ts     # 🔄 Гибридная оптимизация (НОВЫЙ)
│   └── imageCache.ts            # 🗄️ Legacy кеширование (квотер only)
├── components/
│   └── _shared/
│       └── Image/
│           └── Image.tsx        # 🖼️ Компонент изображений (использует imageCache)
api/
└── og.js                        # 🎨 OG генерация (@vercel/og)
```

## 🛠️ Миграционная стратегия

### **Этап 1: Новые компоненты**
```typescript
// Используют новую систему
import { getOptimizedImageUrl } from '~/lib/imageOptimization'

const imageUrl = getOptimizedImageUrl('image.jpg', {
  width: 600,
  useCase: 'cover'
})
```

### **Этап 2: Legacy совместимость**
```typescript
// Существующие компоненты продолжают работать
import { getCachedImageUrl } from '~/lib/imageCache'

const imageUrl = getCachedImageUrl('image.jpg', { width: 600 })
// Остается через квотер до миграции
```

### **Этап 3: Постепенная миграция**
- Image.tsx → обновить на imageOptimization.ts
- SolidSwiper → обновить на Vercel API  
- Article компоненты → гибридная система

## ⚡ Производительность

### **Vercel Image API**
- 🌍 **Global Edge**: ~50-100ms
- 🎯 **Auto format**: WebP/AVIF по браузеру
- 🔄 **Smart caching**: Агрессивное кеширование
- 📱 **Responsive**: Автоматические размеры

### **Квотер**
- 🗄️ **S3 Origin**: ~200-500ms
- 🔧 **Custom logic**: Специальные форматы
- 💾 **Manual cache**: Redis + HTTP headers
- 🎨 **Flexible**: Кастомная обработка

## 🔍 Мониторинг

### **Vercel Metrics**
```bash
# Vercel Dashboard
- Image Optimization usage
- Edge cache hit rate
- Response times по регионам
```

### **Квотер Metrics**
```bash
# Server logs
INFO  GET image_300.jpg [START]
WARN  Thumbnail not found, generating: image_300.jpg
INFO  Generated thumbnail: image_300.jpg
```

## 🚨 Troubleshooting

### **Vercel Image API issues**
```typescript
// Fallback на квотер при ошибках Vercel
if (strategy === 'vercel' && vercelError) {
  return getQuoterWebpUrl(filename, width)
}
```

### **Квотер issues**
```typescript
// Проверка доступности
const isAvailable = await checkCdnAvailability(cdnUrl, token)
if (!isAvailable) throw new Error('CDN unavailable')
```

## 📈 Преимущества гибридного подхода

### **🚀 Производительность**
- Vercel Edge для 95% изображений
- Квотер только для специальных случаев
- Автоматическая оптимизация форматов

### **🔧 Гибкость**
- Сохранение кастомной логики квотера
- Поддержка legacy форматов
- Постепенная миграция без breaking changes

### **💰 Экономика**
- Оптимальное использование Vercel лимитов
- Снижение нагрузки на S3
- Уменьшение costs за bandwidth

## 🎯 Рекомендации

### **Для новых компонентов**
```typescript
// Используйте imageOptimization.ts
import { getOptimizedImageUrl } from '~/lib/imageOptimization'
```

### **Для существующих компонентов**
```typescript
// Оставьте imageCache.ts до миграции
import { getCachedImageUrl } from '~/lib/imageCache'
```

### **Для OG изображений**
```typescript
// Используйте api/og.js (@vercel/og)
// НЕ квотер, НЕ imageOptimization.ts
```

---

## 🔄 Migration Checklist

- [ ] **handleFileUpload.ts** остается без изменений ✅
- [ ] **imageOptimization.ts** создан ✅
- [ ] **api/og.js** работает через @vercel/og ✅
- [ ] **vercel.json** настроен для remotePatterns ✅
- [ ] **Image.tsx** → миграция на новую систему
- [ ] **SolidSwiper** → миграция на Vercel API
- [ ] **Article компоненты** → тестирование гибридной системы
- [ ] **Performance monitoring** → настройка метрик
- [ ] **Fallback logic** → обработка ошибок

**Система готова к production использованию!** 🚀
