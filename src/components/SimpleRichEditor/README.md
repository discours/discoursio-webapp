# SimpleRichEditor

Гибкий WYSIWYG редактор с расширяемой архитектурой.

## Содержание
- [Основные возможности](#основные-возможности)
- [Компоненты](#компоненты)
- [API](#api)
- [Стилизация](#стилизация)
- [Архитектура](#архитектура)

## Основные возможности

### Форматирование текста
- Встроенное форматирование:
  - `bold`, `italic` - базовое форматирование
  - `link` - ссылки с предпросмотром
  - `blockquote` - цитаты
- Блочное форматирование:
  - `h1`, `h2`, `h3` - заголовки
  - `align-left`, `align-center`, `align-right` - выравнивание
  - `bg-gray`, `bg-white`, `bg-black` - цветовые фоны

### Панель инструментов
Реализована в [SimpleToolbar.tsx](./menu/SimpleToolbar.tsx):
- Фиксированная внизу
- Всплывающая над выделением (bubble)
- Автоскрытие меню при потере фокуса
- [Счетчик символов](./lib/counter.ts) с лимитами

### Расширенные возможности
- Редактор сноски (footnote) с кратким меню `['bold', 'italic', 'link']`
- Редактор врезки (squib) с собственным меню стилей `['align-left', 'align-center', 'align-right', 'bg-gray', 'bg-white', 'bg-black', 'bg-yellow', 'bg-red', 'bg-green']`
- Дополнительное [меню](./menu/PlusMenu.tsx) "+" для медиа-контента `['image', 'video', 'audio', 'hr']`
- Обработка вставки из буфера обмена для [медиа-контента и ссылок](./lib/embed.ts)
- Поддержка drag & drop для изображений
- Автосохранение контента

## Компоненты

### SquibMenu
Меню форматирования врезок:
- Меню для оформления врезок
- Позиционируется по центру поля ввода
- Управление выравниванием и фоном

### Upload System
Система загрузки файлов:
- Модальные окна загрузки файлов
- Поддержка:
  - Изображений
  - Аудио
  - Видео (через URL)
- Drag & Drop интерфейс

## API

### Общие пропсы
```typescript
interface SimpleRichEditorProps {
  commands: CommandType[]
  content?: string
  onChange?: (content: string) => void
  onSubmit?: (content: string) => Promise<boolean>
  onCancel?: () => void
  onBlur?: () => void
  placeholder?: string
  bubble?: boolean
  plus?: boolean
  squib?: boolean
  readOnly?: boolean
  hideButtons?: boolean
  limit?: number
}
```

### Команды форматирования
```typescript
type CommandType =
  | 'bold' | 'italic' | 'link'           // Basic formatting
  | 'blockquote' | 'image'               // Block elements
  | 'h1' | 'h2' | 'h3' | 'hr'            // Headings
  | 'footnote' | 'squib'                 // Special elements
  | 'align-left' | 'align-center' | 'align-right' // Alignment
  | 'bg-gray' | 'bg-white' | 'bg-black' 
  | 'bg-yellow' | 'bg-red' | 'bg-green' // Backgrounds
```

### События
- `onChange` - При изменении контента
- `onSubmit` - При сохранении (возвращает Promise<boolean>)
- `onCancel` - При отмене редактирования
- `onBlur` - При потере фокуса

### Горячие клавиши
- `Ctrl/Cmd + B` - Bold
- `Ctrl/Cmd + I` - Italic
- `Ctrl/Cmd + K` - Link
- `Ctrl/Cmd + Enter` - Submit

## Стилизация

### CSS Modules
- Основные стили: `SimpleRichEditor.module.scss`
- Компоненты меню: `menu/*.module.scss`
- Вспомогательные стили: `lib/*.module.scss`

### CSS классы
Основные классы:
- `.editor` - Основной контейнер
- `.toolbar` - Панель инструментов
- `.content` - Область редактирования
- `.buttons` - Кнопки действий

Модификаторы:
- `.focused` - В фокусе
- `.hasContent` - Есть контент
- `.readOnly` - Режим чтения
- `.bubble` - Всплывающее меню
- `.squib` - Режим редактирования врезки

## Архитектура

Основные модули:
- `state.ts` - Управление состоянием редактора
- `commands.ts` - Команды форматирования
- `embed.ts` - Обработка вставки медиа
- `format.ts` - Определение текущего форматирования
- `keyboard.ts` - Обработка горячих клавиш
- `selection.ts` - Работа с выделением текста

Вспомогательные модули:
- `counter.ts` - Подсчет символов
- `footnotes.ts` - Работа со сносками
- `drop.ts` - Обработка drag & drop

## Преимущества

### Производительность
- Нет зависимости от TipTap/ProseMirror
- Меньший размер бандла
- Быстрая инициализация

### Разработка
- Простая кодовая база
- Легкая кастомизация
- Модульная архитектура

## Ограничения

- Хранит историю изменений глубиной в 20 состояний
- Ограниченная поддержка сложного форматирования
- Нет поддержки таблиц и сложных списков
- Нет поддержки вложенных списков
- Ограниченная поддержка RTL текста

