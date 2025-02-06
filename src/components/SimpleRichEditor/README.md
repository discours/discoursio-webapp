# Rich Text Editors

В проекте есть два редактора: RichEditor и SimpleRichEditor. Оба используют нативные браузерные API без внешних зависимостей.

## SimpleRichEditor

Легкий WYSIWYG редактор для комментариев и простых форм.

### Особенности

- Минималистичный интерфейс
- Базовое форматирование (bold, italic, link)
- Всплывающее меню форматирования
- Автосохранение
- Счетчик символов
- Микро-режим для комментариев
- Нет хранения истории изменений

### Использование

```tsx
import { SimpleRichEditor } from './SimpleRichEditor'

<SimpleRichEditor
  content="Initial content"
  onChange={(content) => console.log(content)}
  onSubmit={async (content) => {
    await saveContent(content)
    return true
  }}
  placeholder="Start typing..."
  limit={1000}
  bubble={true}
/>
```

## RichEditor

Расширенный редактор для полноценных публикаций.

### Дополнительные возможности

- Поддержка заголовков (H1-H3)
- Загрузка изображений через drag&drop
- Вставка видео (YouTube, Vimeo)
- Цитаты и списки
- История изменений
- Валидация контента

### Использование

```tsx
import { RichEditor } from './RichEditor'

<RichEditor
  content="Initial content"
  onChange={(content) => console.log(content)}
  onSubmit={async (content) => {
    await saveContent(content)
    return true
  }}
  placeholder="Write your story..."
  autoFocus={true}
/>
```

## Общие возможности

### Props

| Prop | Type | Description |
|------|------|-------------|
| content | string | Начальный контент |
| onChange | (content: string) => void | Колбэк изменения контента |
| onSubmit | (content: string) => Promise<boolean> | Колбэк сохранения |
| onCancel | () => void | Колбэк отмены |
| onBlur | () => void | Колбэк потери фокуса |
| placeholder | string | Плейсхолдер |
| limit | number | Лимит символов |
| autoFocus | boolean | Автофокус |

### Горячие клавиши

- `⌘/Ctrl + B` - Bold
- `⌘/Ctrl + I` - Italic  
- `⌘/Ctrl + U` - Underline (только RichEditor)
- `⌘/Ctrl + K` - Link
- `⌘/Ctrl + Enter` - Submit

## Архитектура

- `state.ts` - Управление состоянием редактора
- `commands.ts` - Команды форматирования
- `embed.ts` - Обработка вставки медиа
- `format.ts` - Определение текущего форматирования
- `keyboard.ts` - Обработка горячих клавиш
- `selection.ts` - Работа с выделением текста

## Преимущества

- Нет зависимости от TipTap/ProseMirror
- Меньший размер бандла
- Простая кодовая база
- Быстрая инициализация
- Легкая кастомизация

## Ограничения

- Хранит историю изменений глубиной в 20 состояний
- Ограниченная поддержка сложного форматирования
- Нет поддержки таблиц и сложных списков

## Рекомендации по использованию

- SimpleRichEditor для комментариев и небольших форм
- RichEditor для полноценных публикаций и статей
- При ограничениях по размеру бандла
- Когда не требуется сложное форматирование



