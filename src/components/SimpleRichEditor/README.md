# SimpleRichEditor

Легкий WYSIWYG редактор без внешних зависимостей, использующий нативные браузерные API.

## Особенности

- Реализация с использованием `contentEditable`
- Поддержка основных форматов текста (bold, italic, underline)
- Поддержка ссылок и цитат
- Загрузка изображений через drag&drop
- Вставка видео (YouTube, Vimeo)
- Всплывающее меню форматирования
- Поддержка горячих клавиш
- Автосохранение
- Счетчик символов
- Валидация контента
- Микро-режим для комментариев

## Использование

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
  micro={true}
/>
```

## API

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
| micro | boolean | Микро-режим для комментариев |
| readOnly | boolean | Режим только для чтения |

### Горячие клавиши

- `⌘/Ctrl + B` - Bold
- `⌘/Ctrl + I` - Italic  
- `⌘/Ctrl + U` - Underline
- `⌘/Ctrl + K` - Link
- `⌘/Ctrl + Enter` - Submit

## Преимущества

- Нет зависимости от TipTap/ProseMirror
- Меньший размер бандла
- Простая кодовая база
- Быстрая инициализация
- Легкая кастомизация

## Ограничения

- Хранит историю изменений глубиной в 20 состояний


## Рекомендации по использованию

- Для комментариев и небольших форм
- Когда не требуется сложное форматирование
- При ограничениях по размеру бандла
- Для простых редакторов с базовым функционалом



