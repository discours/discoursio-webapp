# Rich Editor Documentation

## Функциональность

### 1. Основные возможности форматирования

- **Текстовое форматирование**
  - Жирный текст (⌘B)
  - Курсив (⌘I)
  - Подчеркивание (⌘U)
  - Ссылки (⌘K)
  - Цитаты (blockquote)
  - Заголовки (H1, H2, H3)

- **Структурные элементы**
  - Параграфы
  - Списки (маркированные и нумерованные)
  - Врезки (incut)
  - Подписи к изображениям (figcaption)
  - Примечания (`<tooltip>`)

### 2. Медиа-контент

- **Изображения**
  - Загрузка через drag&drop
  - Вставка из буфера обмена
  - Загрузка через модальное окно
  - Подписи к изображениям
  - Позиционирование (left, center, right)
  - Размеры (small, medium, large)

- **Видео**
  - Вставка через URL (YouTube, Vimeo)
  - Предпросмотр
  - Настройки размера

- **Аудио**
  - Загрузка аудиофайлов
  - Встроенный плеер
  - Плейлисты

### 3. Интерактивные элементы

- **Всплывающие меню**
  - Текстовое форматирование (BubbleMenu)
  - Настройки изображений (ImageBubbleMenu)
  - Настройки цитат (BlockquoteBubbleMenu)
  - Настройки врезок (IncutBubbleMenu)

- **Плавающее меню**
  - Вставка медиа
  - Форматирование блоков
  - Добавление специальных элементов

### 4. Расширенные возможности

- **Коллаборация**
  - Совместное редактирование
  - Отслеживание курсоров
  - История изменений

- **Автосохранение**
  - Периодическое сохранение
  - Восстановление черновиков
  - Индикация статуса сохранения

- **Валидация**
  - Проверка ссылок
  - Ограничение размера
  - Обязательные поля

### 5. Режимы работы

- **Полный редактор**
  - Все возможности форматирования
  - Панель инструментов
  - Боковая панель

- **Упрощенный редактор**
  - Базовое форматирование
  - Минимальный интерфейс
  - Быстрые действия

- **Микро-редактор**
  - Только текст и базовое форматирование
  - Всплывающее меню
  - Однострочный режим

### 6. Пользовательский опыт

- **Горячие клавиши**
  ```typescript
  const SHORTCUTS = {
    'mod+b': 'bold',
    'mod+i': 'italic',
    'mod+u': 'underline',
    'mod+k': 'link',
    'mod+1': 'h1',
    'mod+2': 'h2',
    'mod+3': 'h3',
    'shift+enter': 'softBreak',
    'mod+enter': 'submit'
  }
  ```

- **Контекстные меню**
  - Умное позиционирование
  - Анимации появления/исчезновения
  - Адаптивный интерфейс

- **Доступность**
  - Поддержка клавиатурной навигации
  - ARIA-атрибуты
  - Высокий контраст

### 7. Техническая реализация

- **Архитектура**
  ```typescript
  interface EditorState {
    content: string
    selection: Selection
    history: HistoryState
    collaborators: Collaborator[]
    format: FormatState
    media: MediaState
  }

  interface EditorActions {
    format: FormatActions
    insert: InsertActions
    history: HistoryActions
    collaboration: CollaborationActions
  }
  ```

- **Расширения**
  - Базовые (текст, параграфы)
  - Форматирование (bold, italic, etc)
  - Медиа (images, video, audio)
  - Специальные (incut, tooltip)

- **События**
  ```typescript
  interface EditorEvents {
    onChange: (content: string) => void
    onSave: () => Promise<void>
    onSelectionChange: (selection: Selection) => void
    onCollaboratorJoin: (user: User) => void
    onMediaUpload: (file: File) => Promise<string>
  }
  ```

## Примеры использования

### Базовая инициализация

```typescript
const editor = new RichEditor({
  element: '#editor',
  content: initialContent,
  placeholder: 'Начните писать...',
  autofocus: true,
  onChange: (content) => {
    console.log('Content changed:', content)
  }
})
```

### Расширенная конфигурация

```typescript
const editor = new RichEditor({
  // Основные настройки
  element: '#editor',
  content: initialContent,
  
  // Возможности
  features: {
    formatting: true,
    media: true,
    collaboration: false,
    history: true
  },
  
  // Плагины
  extensions: [
    Heading,
    Bold,
    Italic,
    Link,
    Image,
    Blockquote,
    BulletList,
    OrderedList
  ],
  
  // Обработчики событий
  handlers: {
    onSave: async (content) => {
      await api.saveContent(content)
    },
    onMediaUpload: async (file) => {
      const url = await api.uploadFile(file)
      return url
    }
  },
  
  // Внешний вид
  theme: {
    dark: false,
    colors: {
      primary: '#0066cc',
      text: '#333333'
    },
    spacing: {
      block: '1em'
    }
  }
})
```

## Стилизация

### Основные компоненты

```scss
.editor {
  // Контейнер
  &-container {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-color);
  }

  // Панель инструментов
  &-toolbar {
    display: flex;
    gap: 4px;
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  // Область редактирования
  &-content {
    min-height: 200px;
    padding: 16px;
    
    &[data-placeholder]:empty::before {
      content: attr(data-placeholder);
      color: var(--placeholder-color);
    }
  }
}
```

### Всплывающие меню

```scss
.bubble-menu {
  position: absolute;
  display: flex;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  
  &-button {
    padding: 4px 8px;
    border: none;
    background: none;
    
    &:hover {
      background: var(--hover-color);
    }
    
    &.active {
      color: var(--primary-color);
    }
  }
}
```

## Дополнительные материалы

- [Tiptap Documentation](https://tiptap.dev/)
- [ProseMirror Guide](https://prosemirror.net/docs/guide/)
- [SolidJS Components](https://www.solidjs.com/docs/latest/api#components) 