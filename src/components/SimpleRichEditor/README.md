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


# API

## Основные параметры компонента

```typescript
interface SimpleRichEditorProps {
  // Уникальный идентификатор редактора, используется для синхронизации и сохранения состояния
  editorId: string;
  
  // Тип поля (body, lead и т.д.), влияет на поведение редактора и стилизацию
  fieldType: string;
  
  // Позиция панели инструментов: "bottom" | "top" | "bubble"
  toolbar: string;
  
  // Доступные команды форматирования
  commands: CommandType[];
  
  // Исходное содержимое редактора в HTML формате
  content?: string;
  
  // Обработчик изменения содержимого
  onChange?: (data: EditorData) => void;
  
  // Обработчик отправки формы (Ctrl+Enter)
  onSubmit?: (content: string) => Promise<boolean>;
  
  // Обработчик отмены редактирования (Esc)
  onCancel?: () => void;
  
  // Обработчик потери фокуса
  onBlur?: () => void;
  
  // Обработчик получения фокуса
  onFocus?: () => void;
  
  // Обработчик инициализации редактора
  onInit?: (instance: EditorInstance) => void;
  
  // Текст заполнителя, когда редактор пуст
  placeholder?: string;
  
  // Включение всплывающей панели инструментов при выделении текста
  bubble?: boolean;
  
  // Включение меню "+" для вставки медиа-контента
  plus?: boolean;
  
  // Включение режима врезки с дополнительными стилями оформления
  squib?: boolean;
  
  // Режим только для чтения
  readOnly?: boolean;
  
  // Скрыть кнопки действий (сохранить/отменить)
  hideButtons?: boolean;
  
  // Ограничение на количество символов
  limit?: number;
}
```

## Структура данных

### EditorData
```typescript
interface EditorData {
  // HTML содержимое редактора
  content: string;
  
  // Флаг, указывающий, пуст ли редактор (учитывает пустые блоки)
  isEmpty: boolean;
  
  // Статистика текста (количество символов, слов и т.д.)
  stats?: {
    chars: number;
    words: number;
    paragraphs: number;
  };
}
```

### EditorInstance
```typescript
interface EditorInstance {
  // DOM-элемент редактора
  editor: HTMLDivElement;
  
  // Методы для программного управления редактором
  methods: {
    // Установить содержимое редактора
    setContent: (html: string) => void;
    
    // Получить текущее содержимое
    getContent: () => string;
    
    // Очистить содержимое
    clear: () => void;
    
    // Установить/снять фокус
    focus: () => void;
    blur: () => void;
    
    // Добавить HTML в текущую позицию курсора
    insertHTML: (html: string) => void;
  };
}
```

## Команды форматирования

```typescript
type CommandType =
  // Базовое форматирование текста
  | 'bold'       // Полужирный
  | 'italic'     // Курсив
  | 'link'       // Ссылка
  
  // Блочные элементы
  | 'blockquote' // Цитата
  | 'image'      // Изображение
  | 'video'      // Видео
  | 'audio'      // Аудио
  | 'hr'         // Горизонтальная линия
  
  // Заголовки
  | 'h1' | 'h2' | 'h3'
  
  // Специальные элементы
  | 'footnote'   // Сноска
  | 'squib'      // Врезка
  
  // Выравнивание текста
  | 'align-left' | 'align-center' | 'align-right'
  
  // Цветовые фоны
  | 'bg-gray' | 'bg-white' | 'bg-black' 
  | 'bg-yellow' | 'bg-red' | 'bg-green'
```

## Примеры использования

### Основной редактор статьи
```tsx
<SimpleRichEditor
  editorId={`draft-${draftId}-body`}
  fieldType="body"
  toolbar="bottom"
  commands={['bold', 'italic', 'link', 'blockquote', 'image']}
  content={initialContent}
  onChange={(data) => handleInputChange('body', data.content)}
  onInit={(instance) => setBodyEditorRef(instance.editor)}
  onFocus={() => handleBodyEditorFocus(true)}
  onBlur={() => handleBodyEditorFocus(false)}
  plus={true}
/>
```

### Редактор краткого вступления
```tsx
<SimpleRichEditor
  editorId={`draft-${draftId}-lead`}
  fieldType="lead"
  toolbar="bottom"
  commands={['bold', 'italic', 'link']}
  placeholder="Краткое введение для привлечения интереса читателя"
  content={leadContent}
  onChange={handleLeadEditorChange}
  onBlur={saveLead}
/>
```

### Редактор комментария
```tsx
<SimpleRichEditor
  editorId={`comment-${commentId}`}
  fieldType="comment"
  commands={['bold', 'italic', 'link', 'blockquote']}
  placeholder="Введите ваш комментарий..."
  onChange={(data) => setCommentText(data.content)}
  onSubmit={handleSubmitComment}
  onCancel={handleCancelComment}
  limit={5000}
/>
```

## Режимы панели инструментов

### bottom
Панель инструментов фиксируется внизу области редактирования.
Хорошо подходит для больших текстовых полей.

### top
Панель инструментов фиксируется вверху области редактирования.
Удобно для небольших текстовых полей.

### bubble
Панель инструментов появляется над выделенным текстом.
Обеспечивает чистый интерфейс и быстрый доступ к форматированию.

## Колаборативное редактирование

Редактор поддерживает совместную работу через систему awareness:

- Синхронизация изменений между пользователями
- Отображение курсоров и выделений других пользователей
- Отложенное сохранение при отсутствии подключения к серверу
- Автоматическое восстановление соединения

### События collaborative editing
```typescript
interface CollaborationEvents {
  // Подключение к серверу синхронизации
  onConnect?: () => void;
  
  // Отключение от сервера синхронизации
  onDisconnect?: () => void;
  
  // Обновление состояния присутствия других пользователей
  onPresenceUpdate?: (users: User[]) => void;
}
```

## Горячие клавиши

- `Ctrl/Cmd + B` - Полужирный
- `Ctrl/Cmd + I` - Курсив
- `Ctrl/Cmd + K` - Ссылка
- `Ctrl/Cmd + Enter` - Отправка формы
- `Esc` - Отмена редактирования
- `Ctrl/Cmd + Z` - Отменить последнее действие
- `Ctrl/Cmd + Y` - Повторить действие


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

