# SimpleRichEditor

Гибкий WYSIWYG редактор с расширяемой архитектурой на SolidJS.

## Содержание
- [Основные возможности](#основные-возможности)
- [Архитектура](#архитектура)
- [API](#api)
- [Компоненты](#компоненты)
- [Горячие клавиши](#горячие-клавиши)
- [Стилизация](#стилизация)

## Основные возможности

### 📝 Форматирование текста

#### Инлайн форматирование
  - `bold`, `italic` - базовое форматирование
- `link` - ссылки с inline формой
  - `highlight` - выделение текста
- `tooltip` - всплывающие подсказки (кастомный тег)

#### Блочное форматирование
- `h1`, `h2`, `h3` - заголовки с правильным переключением между уровнями
- `blockquote` - цитаты с toggle отменой
- `punchline` - ударные цитаты (акцентированный блок)
  - `p` - обычные параграфы
- `incut` - врезки с настраиваемым выравниванием и фоном

#### Стилизация врезок
- **Выравнивание:** `align-left`, `align-center`, `align-right`
- **Цветовые фоны:** `bg-gray`, `bg-white`, `bg-black`, `bg-yellow`, `bg-red`, `bg-green`

#### Списки
- `bulletList` - маркированные списки
- `orderedList` - нумерованные списки

### 🎨 Панель инструментов

Реализована в [SimpleToolbar.tsx](./menu/SimpleToolbar.tsx):
- **Три режима отображения:**
  - `top` - фиксированная вверху
  - `bottom` - фиксированная внизу
  - `float` - всплывающая над выделением
- Автоскрытие при потере фокуса
- Поддержка групп команд и выпадающих меню
- Динамическое отображение активных форматов

### 📎 Медиа-контент

#### Поддерживаемые типы
- **Изображения:** JPEG, PNG, GIF, WebP, AVIF (до 500MB)
- **Аудио:** MP3, WAV, OGG, M4A, FLAC
- **Видео:** YouTube, Vimeo (через URL)
- **Preview:** 20+ платформ с автоматическим распознаванием

#### Drag & Drop
  - ✅ Полная поддержка `dragover`, `dragenter`, `dragleave`, `drop` событий
- ✅ Визуальная индикация области drop
  - ✅ Правильное восстановление выделения через клонирование Range
  - ✅ Параллельная загрузка до 3 файлов одновременно
  - ✅ Прогресс-индикатор с отображением текущего/общего количества файлов
- ✅ Валидация типов и размеров файлов

#### Preview платформы
**Видео:** YouTube, Vimeo, Twitch, TED  
**Аудио:** SoundCloud, Bandcamp  
**Социальные сети:** Twitter/X, Instagram, Facebook, Telegram, Reddit, TikTok, OK.ru  
**Медиа хостинги:** Imgur, Flickr, SlideShare  
**Прочее:** Wikipedia, Discours.io

### ⚡ Дополнительные возможности

- **Plus-меню** (`+`) - умное позиционирование для вставки медиа
- **Автосохранение** - версионирование контента в localStorage
- **Обработка вставки** - автоматическое распознавание URL и медиа
- **HTML placeholder** - стандартный placeholder вместо кастомного компонента
- **Восстановление фокуса** - правильное возвращение курсора после форматирования
- **Inline формы** - бесшовная интеграция форм прямо в текст

## Архитектура

После рефакторинга 2025 года редактор имеет модульную архитектуру с четким разделением ответственности.

### 🏗️ Структура директорий

```
SimpleRichEditor/
├── format/              # Система форматирования
│   ├── config.ts        # Конфигурация команд (FORMAT_CONFIG)
│   ├── common.ts        # Единая точка входа (executeCommand)
│   ├── inline.ts        # Инлайн форматирование (bold, italic, link)
│   ├── block.ts         # Блочное форматирование (h1, h2, h3, blockquote)
│   ├── detection.ts     # Определение активного форматирования
│   ├── utils.ts         # Утилиты для работы с DOM и выделением
│   ├── types.ts         # TypeScript типы
│   └── format.ts        # Главный экспорт
│
├── handlers/            # Обработчики событий (SolidJS composition)
│   ├── events.ts        # Ввод, фокус, вставка, drag & drop
│   ├── forms.ts         # Inline формы и модальные окна
│   ├── keyboard.ts      # Клавиатурные шорткаты
│   ├── media.ts         # Обработка кликов по медиа-элементам
│   └── ui.ts            # UI хелперы и примитивы меню
│
├── lib/                 # Базовая функциональность
│   ├── types.ts         # TypeScript типы и интерфейсы
│   ├── command.ts       # Категоризация команд
│   ├── selection.ts     # Работа с выделением (useSelection hook)
│   ├── storage.ts       # Автосохранение и версионирование
│   ├── actions.ts       # Обработка команд редактора
│   ├── utils.ts         # Общие утилиты
│   ├── empty.ts         # Проверка пустого контента
│   ├── sanitize.ts      # Очистка HTML
│   ├── positioning.ts   # Позиционирование меню
│   ├── timing.ts        # Утилиты для задержек и debounce
│   └── dom-utils.ts     # Работа с DOM
│
├── media/               # Система медиа-контента
│   ├── upload.ts        # Drag & drop и загрузка файлов
│   ├── insertion.ts     # Вставка медиа в редактор
│   ├── html.ts          # Генерация HTML для медиа и preview
│   ├── validation.ts    # Валидация URL и распознавание платформ
│   ├── previewLoader.ts # Lazy loading SDK для preview виджетов
│   ├── previewMetadata.ts # Open Graph / oEmbed метаданные
│   ├── previewRenderer.ts # Рендеринг preview тегов
│   ├── handlers.ts      # Обработчики медиа-событий
│   ├── types.ts         # TypeScript типы
│   └── index.ts         # Главный экспорт
│
├── menu/                # Компоненты меню
│   ├── SimpleToolbar.tsx # Основная панель инструментов
│   ├── PlusMenu.tsx     # Меню добавления медиа-контента
│   ├── IncutMenu.tsx    # Меню форматирования врезок
│   ├── config.ts        # Конфигурация групп команд
│   ├── helpers.ts       # Утилиты для работы с меню
│   └── presets.ts       # Предустановленные наборы команд
│
├── components/          # Вспомогательные компоненты
│   └── PreviewInlineChoice.tsx # Inline выбор типа вставки
│
└── SimpleRichEditor.tsx # Главный компонент
```

### 🔄 Принципы архитектуры

1. **SolidJS Function Composition** - Вместо React-хуков используются функции композиции
2. **Единая точка входа** - Все команды форматирования проходят через `executeCommand`
3. **Модульность** - Каждый модуль отвечает за одну область функциональности
4. **DRY принцип** - Устранено дублирование кода между модулями
5. **Типизация** - Строгая типизация TypeScript для всех интерфейсов
6. **Примитивы UI** - Разделение ответственности между видимостью и позиционированием

### 🎯 Ключевые модули

#### `format/common.ts` - Унифицированная система форматирования
```typescript
// Единая функция для выполнения всех команд
executeCommand(command: CommandType, context: FormatContext): FormatResult

// Проверка активности команды
isCommandActive(command: CommandType, selection: SelectionState): boolean

// Получение доступных команд
getAvailableCommands(context: FormatContext): CommandType[]
```

#### `handlers/events.ts` - Обработчики событий
```typescript
// Обработка ввода текста с автоматическим распознаванием URL
handleInput(e: InputEvent): void

// Вставка из буфера с поддержкой preview
handlePaste(e: ClipboardEvent): void

// Drag & Drop для файлов и URL
handleDragOver(e: DragEvent): void
handleDropFiles(e: DragEvent): void
```

#### `media/validation.ts` - Распознавание платформ
```typescript
// Определение платформы по URL (20+ платформ)
detectPreviewPlatform(url: string): PreviewPlatform

// Определение типа контента
recognizeContentType(url: string): ContentType

// Валидация URL
isValidUrl(url: string): boolean
```

#### `lib/selection.ts` - Работа с выделением
```typescript
// Hook для отслеживания выделения и курсора
useSelection(
  editorRef: Accessor<HTMLDivElement>,
  toolbarMode: Accessor<string>,
  editorId?: Accessor<string>
)

// Создание состояния выделения
createSelectionState(
  editor: HTMLElement,
  cursorPosition?: Position
): SelectionState | null

// Валидация выделения
validateSelection(editor: HTMLElement): SelectionValidationResult
```

### 🎨 Примитивы Plus-меню

Реализованы в `handlers/ui.ts` с четким разделением ответственности:

#### `shouldShowPlusMenu(): boolean`
- **Ответственность:** Только видимость меню
- **Условия:** Курсор на пустой строке + редактор в фокусе + нет других открытых меню
- **Обновление:** При клике и движении курсора

#### `getPlusMenuTop(): number`
- **Ответственность:** Только вертикальная позиция
- **Логика:** Вычисление на основе индекса строки курсора
- **Обновление:** При движении курсора между строками

#### `getPlusMenuLeft(): number`
- **Ответственность:** Только горизонтальная позиция
- **Логика:** Фиксированная позиция слева от редактора
- **Обновление:** Один раз при рендере редактора

## API

### Основные параметры компонента

```typescript
interface SimpleRichEditorProps {
  // Уникальный идентификатор редактора
  editorId?: string
  
  // Тип поля (body, lead, title, comment, about)
  fieldType?: EditorFieldType
  
  // Режим панели инструментов: "top" | "bottom" | "float"
  toolbar?: ToolbarMode
  
  // Доступные команды форматирования
  commands?: readonly (CommandType | readonly CommandType[])[]
  
  // Исходное содержимое редактора в HTML формате
  content?: string
  
  // Обработчик изменения содержимого
  onChange: (data: EditorData) => void
  
  // Обработчик потери фокуса
  onBlur?: () => void
  
  // Обработчик получения фокуса
  onFocus?: () => void
  
  // Обработчик инициализации редактора
  onInit?: (instance: { editor: HTMLDivElement }) => void
  
  // Текст заполнителя
  placeholder?: string
  
  // Включение меню "+" для вставки медиа-контента
  plus?: boolean
  
  // Автофокус при монтировании
  autofocus?: boolean
  
  // Режим только для чтения
  readOnly?: boolean
  
  // Колаборативное редактирование
  collaborative?: boolean
  
  // Обновление курсора для колаборации
  onCollabCursorUpdate?: (data: Position) => void
}
```

### Структура данных

#### EditorData
```typescript
interface EditorData {
  // HTML содержимое редактора
  content: string
  
  // Чистый текст без HTML
  plainText: string
  
  // Длина текста
  length: number
  
  // Флаг пустого редактора
  isEmpty: boolean
  
  // Информация о выделении
  selection?: {
    text: string
    isEmpty: boolean
    position?: Position
  }
}
```

#### SelectionState
```typescript
interface SelectionState {
  // Range объект выделения
  range: Range | null
  
  // Выделенный текст
  text: string
  
  // Флаг пустого выделения (курсор)
  isEmpty: boolean
  
  // Позиция курсора
  position: Position
}
```

### Команды форматирования

```typescript
type CommandType =
  // Базовое форматирование
  | 'bold'       // Полужирный
  | 'italic'     // Курсив
  | 'link'       // Ссылка
  | 'unlink'     // Удалить ссылку
  | 'highlight'  // Выделение
  
  // Блочные элементы
  | 'blockquote' // Цитата
  | 'punchline'  // Ударная цитата
  | 'p'          // Параграф
  
  // Заголовки
  | 'h1' | 'h2' | 'h3'
  
  // Списки
  | 'bulletList'   // Маркированный список
  | 'orderedList'  // Нумерованный список
  
  // Медиа
  | 'image'    // Изображение
  | 'video'    // Видео
  | 'audio'    // Аудио
  | 'preview'  // Preview виджет
  
  // Специальные элементы
  | 'tooltip'  // Подсказка
  | 'incut'    // Врезка
  | 'hr'       // Горизонтальная линия
  
  // Выравнивание
  | 'align-left' | 'align-center' | 'align-right'
  
  // Цветовые фоны
  | 'bg-gray' | 'bg-white' | 'bg-black' 
  | 'bg-yellow' | 'bg-red' | 'bg-green'
```

### Примеры использования

#### Основной редактор статьи
```tsx
<SimpleRichEditor
  editorId={`draft-${draftId}-body`}
  fieldType="body"
  toolbar="bottom"
  commands={['bold', 'italic', 'link', 'blockquote', 'image']}
  content={initialContent}
  onChange={(data) => handleInputChange('body', data.content)}
  onInit={(instance) => setBodyEditorRef(instance.editor)}
  plus={true}
/>
```

#### Редактор краткого вступления
```tsx
<SimpleRichEditor
  editorId={`draft-${draftId}-lead`}
  fieldType="lead"
  toolbar="bottom"
  commands={['bold', 'italic', 'link']}
  placeholder="Краткое введение для привлечения интереса читателя"
  content={leadContent}
  onChange={handleLeadEditorChange}
/>
```

#### Редактор комментария
```tsx
<SimpleRichEditor
  editorId={`comment-${commentId}`}
  fieldType="comment"
  commands={['bold', 'italic', 'link', 'blockquote']}
  placeholder="Введите ваш комментарий..."
  onChange={(data) => setCommentText(data.content)}
/>
```

## Компоненты

### SimpleToolbar
Основная панель инструментов с поддержкой групп команд.

**Возможности:**
- Три режима отображения (top, bottom, float)
- Выпадающие меню для групп команд
- Динамическое отображение активных форматов
- Автоскрытие при потере фокуса

**Группы команд:**
- `text` - Базовое форматирование
- `headings` - Заголовки
- `quotes` - Цитаты и врезки
- `lists` - Списки
- `links` - Ссылки
- `media` - Медиа контент
- `align` - Выравнивание
- `backgrounds` - Фоны

### PlusMenu
Меню добавления медиа-контента с умным позиционированием.

**Возможности:**
- Позиционируется слева от текущей строки курсора
- Отслеживает вертикальное перемещение курсора в реальном времени
- Показывается только на пустых строках
- Поддерживает команды: `image`, `video`, `audio`, `preview`, `hr`

### IncutMenu
Меню форматирования врезок с настройками выравнивания и фона.

**Возможности:**
- Позиционируется по центру редактора над блоком врезки
- Управление выравниванием (left, center, right)
- Управление фоном (gray, white, black, yellow, red, green)
- Кнопка удаления врезки

### PreviewInlineChoice
Компактный inline выбор типа вставки URL.

**Возможности:**
- Показывается при вставке распознанного URL
- Выбор между preview виджетом и обычной ссылкой
- Tooltip с превью при hover на кнопку "Preview"
- Автоматическое определение поддерживаемых платформ

## Горячие клавиши

Реализованы в [handlers/keyboard.ts](./handlers/keyboard.ts).

### Форматирование
- `Ctrl/Cmd + B` - Полужирный
- `Ctrl/Cmd + I` - Курсив  
- `Ctrl/Cmd + K` - Ссылка
- `Ctrl/Cmd + Q` - Цитата (blockquote)
- `Ctrl/Cmd + 1` - Заголовок H1
- `Ctrl/Cmd + 2` - Заголовок H2
- `Ctrl/Cmd + 3` - Заголовок H3

### Навигация
- `Tab` - Переход к следующему полю (title → lead → body)
- `Shift + Tab` - Переход к предыдущему полю
- `Enter` - Создание нового параграфа
- `Backspace` - Удаление с умной обработкой пустых блоков

### Действия
- `Ctrl/Cmd + Enter` - Отправка формы
- `Esc` - Отмена редактирования / закрытие форм

## Стилизация

### CSS Modules
- `SimpleRichEditor.module.scss` - Основные стили
- `menu/*.module.scss` - Стили компонентов меню
- `media/styles.module.scss` - Стили медиа-элементов

### CSS классы

**Основные:**
- `.editor` - Основной контейнер
- `.toolbar` - Панель инструментов
- `.content` - Область редактирования
- `.floatingToolbar` - Всплывающая панель

**Модификаторы:**
- `.focused` - Редактор в фокусе
- `.empty` - Пустой редактор
- `.hasSelection` - Есть выделение текста
- `.readOnly` - Режим только для чтения
- `.withTopToolbar` - С верхней панелью
- `.withBottomToolbar` - С нижней панелью

**Блочные элементы:**
- `[data-align]` - Врезки с выравниванием
- `[data-bg]` - Элементы с цветовым фоном
- `.punchline` - Ударные цитаты

## Преимущества

### Производительность
- Нет зависимости от TipTap/ProseMirror
- Меньший размер бандла
- Быстрая инициализация
- Оптимизированные обработчики событий

### Разработка
- Простая кодовая база
- Легкая кастомизация
- Модульная архитектура
- Строгая типизация TypeScript

### Пользовательский опыт
- Интуитивный интерфейс
- Быстрая работа
- Поддержка drag & drop
- Автоматическое распознавание контента

## Ограничения

- Хранит историю изменений глубиной в 20 состояний
- Ограниченная поддержка сложного форматирования
- Нет поддержки таблиц
- Нет поддержки вложенных списков
- Ограниченная поддержка RTL текста

## Технические детали

### Зависимости
- SolidJS - реактивный фреймворк
- clsx - утилита для работы с классами
- SCSS Modules - изолированные стили

### Совместимость
- Современные браузеры (Chrome, Firefox, Safari, Edge)
- Поддержка touch-устройств
- SSR-совместимый (с проверкой `isServer`)

### Безопасность
- Санитизация HTML контента
- Валидация URL перед вставкой
- Проверка доменов для preview виджетов
- Ограничение размера загружаемых файлов