# SimpleRichEditor

## Описание

Легковесный редактор для форматированного текста без внешних зависимостей:

- Использует нативный contentEditable
- Реактивное состояние на SolidJS
- Минимальный размер бандла (~5KB)
- Имитирует API [MiniEditor](src/components/Editor/MiniEditor.tsx) для совместимости
- Имитирует API [MicroEditor](src/components/Editor/MicroEditor.tsx) для совместимости

## Возможности

- Базовое форматирование (bold, italic)
- Микро-режим
- Ссылки с валидацией
- Цитаты (blockquote)
- Вставка изображений
- Горячие клавиши
- Автофокус и восстановление выделения
- Сохранение черновиков

## Использование

```tsx
import { SimpleRichEditor } from '~/components/SimpleRichEditor'

<SimpleRichEditor
  content="Начальный текст"
  onSubmit={(content) => handleSubmit(content)}
  onCancel={() => handleCancel()}
  placeholder="Введите текст..."
  autoFocus={true}
  limit={1000} // Опционально
/>
```

## Преимущества

- Нет зависимости от TipTap/ProseMirror
- Меньший размер бандла
- Простая кодовая база
- Быстрая инициализация
- Легкая кастомизация

## Рекомендации по использованию

- Для комментариев и небольших форм
- Когда не требуется сложное форматирование
- При ограничениях по размеру бандла
- Для простых редакторов с базовым функционалом



