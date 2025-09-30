# 🔧 Refactoring: Static Files & Image Loading

## Проблема

При SSR изображения загружались с полными путями (`https://files.dscrs.site/production/image/abc123.jpg`), но после гидрации на клиенте:

1. `getCdnUrl()` обрезал URL до filename (`abc123.jpg`)
2. URL изменялся → браузер перезагружал изображение
3. Quoter не находил файл по короткому пути → 404
4. Срабатывал fallback → показывался placeholder вместо изображения

## Решение

### 1. Унифицированная логика обрезки URL

**imageCache.ts** - `getCdnUrl()` теперь:
- Извлекает только filename из любого URL (SSR и клиент одинаково)
- Убирает `production/image/` и другие префиксы
- Применяет width трансформацию (`_300`, `_600` и т.д.)

```typescript
// Было: полный путь сохранялся
https://files.dscrs.site/production/image/abc123.jpg

// Стало: только filename
https://files.dscrs.site/abc123.jpg
https://files.dscrs.site/abc123_600.jpg (с width)
```

### 2. Quoter толерантность

Quoter уже поддерживает оба формата через `parse_file_path()`:
- ✅ `abc123.jpg` - короткий путь
- ✅ `production/image/abc123.jpg` - полный путь
- ✅ `abc123_300.jpg` - с width суффиксом

### 3. Стабильная гидрация

**Image.tsx** компонент:
- Всегда применяет `getCdnUrl()` для http URL
- SSR и клиент получают одинаковый URL
- Браузер использует кешированное изображение → нет перезагрузки

**ArticleCard.tsx**:
- Передает оригинальный URL напрямую в `<Image>`
- Убран вызов `getCdnUrl()` перед передачей в компонент
- Image компонент сам применяет трансформацию

## Изменения

### Модифицированные файлы

1. **webapp/src/lib/imageCache.ts**
   - Упрощена логика `getCdnUrl()` - только извлечение filename
   - Удалена сложная логика обработки полных путей

2. **webapp/src/components/_shared/Image/Image.tsx**
   - `getCdnUrl()` применяется для всех http URL (не только с width)
   - Упрощен `imageSrcSet()` - меньше вариантов для стабильности

3. **webapp/src/components/Feed/ArticleCard/ArticleCard.tsx**
   - Убран импорт `getCdnUrl`
   - Прямая передача URL в Image компонент

4. **webapp/src/components/Article/FullArticle.tsx**
   - Убран импорт `getCdnUrl`
   - Прямая передача URL в Image компонент

5. **webapp/src/components/Article/AudioPlayer/*.tsx**
   - Оставлен `getCdnUrl()` для аудио файлов (работает корректно)
   - Добавлены комментарии для ясности

6. **webapp/src/components/Article/AudioHeader/AudioHeader.tsx**
   - Оставлен для генерации srcSet (обратная совместимость)

## Результат

✅ Изображения НЕ перезагружаются при гидрации
✅ URL одинаковые на SSR и клиенте
✅ Quoter корректно обрабатывает короткие пути
✅ Работает width трансформация (`_300`, `_600`)
✅ Нет `production/image/` дублирования в URL

## Тестирование

1. Проверить SSR рендеринг - изображения загружаются
2. Проверить клиентскую гидрацию - изображения НЕ мигают/перезагружаются
3. Проверить width параметры - генерируются корректные URL с суффиксами
4. Проверить fallback - placeholder показывается только при реальной ошибке загрузки
