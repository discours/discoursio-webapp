# Редактор discours.io

## Режимы редактора

| Функция | Полный редактор | Мини-редактор | Микро-редактор |
|---------|-----------------|----------------|----------------|
| **Компонент** | `EditorComponent` | `MiniEditor` | `MicroEditor` |
| **Назначение** | Статьи, посты | Комментарии | Подписи, заметки |
| **Форматирование** | Полное | Базовое | Минимальное |
| **Медиа** | ✅ | ❌ | ❌ |
| **Автосохранение** | ✅ | ❌ | ❌ |
| **Коллаборация** | ✅ | ❌ | ❌ |
| **Горячие клавиши** | ✅ | ✅ | ✅ |
| **Валидация** | ✅ | ✅ | ✅ |
| **Размер бандла** | ~100KB | ~30KB | ~15KB |

## Возможности форматирования

| Функция | Полный | Мини | Микро | Компонент |
|---------|---------|------|-------|-----------|
| Жирный текст | ✅ | ✅ | ✅ | `MicroBubbleMenu` |
| Курсив | ✅ | ✅ | ✅ | `MicroBubbleMenu` |
| Ссылки | ✅ | ✅ | ✅ | `MicroBubbleMenu` |
| Заголовки (H1-H3) | ✅ | ❌ | ❌ | `FullBubbleMenu` |
| Списки | ✅ | ❌ | ❌ | `FullBubbleMenu` |
| Цитаты | ✅ | ✅ | ❌ | `BlockquoteBubbleMenu` |
| Изображения | ✅ | ❌ | ❌ | `FigureBubbleMenu` |
| Врезки | ✅ | ❌ | ❌ | `IncutBubbleMenu` |
| Сноски | ✅ | ❌ | ❌ | `FullBubbleMenu` |
| Подсветка текста | ✅ | ❌ | ❌ | `FullBubbleMenu` |

## Архитектура

### Компоненты редактора

```
Editor/
├── Editor.tsx      # Полный редактор статей
│ ├── EditorComponent # Основной компонент
│ ├── Panel/ # Боковая панель управления
│ └── AutoSaveNotice # Уведомление о сохранении
├── MiniEditor.tsx # Редактор комментариев
│ ├── MiniEditor # Упрощенный редактор
│ └── MicroBubbleMenu # Базовая панель инструментов
├── MicroEditor.tsx # Встраиваемый редактор
│ └── MicroBubbleMenu # Минимальная панель
├── Toolbar/ # Панели инструментов
│ ├── FullBubbleMenu # Полная панель
│ ├── BlockquoteBubbleMenu # Управление цитатами
│ ├── FigureBubbleMenu # Управление изображениями
│ ├── IncutBubbleMenu # Управление врезками
│ └── EditorFloatingMenu # Плавающее меню
└── extensions/ # Расширения TipTap
├── Article # Врезки и статьи
├── CustomBlockquote # Кастомные цитаты
└── TrailingNode # Завершающий узел
```
### Контекст и состояние

#### EditorContext
- [editor.tsx](src/context/editor.tsx) - Основной контекст
- [EditorProvider](src/context/editor.tsx#L45) - Провайдер состояния
- [useEditorContext](src/context/editor.tsx#L25) - Хук для доступа

#### Состояния редактора

```typescript
export interface EditorState {
    isReady: boolean // Готовность к работе
    isCollabMode: boolean // Режим коллаборации
    saving: boolean // Идет сохранение
    hasChanges: boolean // Есть изменения
    content: string // Содержимое
    selection: Selection // Текущее выделение
}
```

## Режимы работы

### 1. Обычный режим
- Одиночное редактирование
- Автосохранение черновиков
- Полный набор инструментов
- [EditorComponent.tsx](src/components/Editor/Editor.tsx)

### 2. Коллаборативный режим
- Совместное редактирование
- Отображение курсоров
- Разрешение конфликтов
- [CollaborationExtension](src/components/Editor/extensions/Collaboration.ts)

### 3. Режим комментариев
- Упрощенный интерфейс
- Базовое форматирование
- Быстрое сохранение
- [MiniEditor.tsx](src/components/Editor/MiniEditor.tsx)

### 4. Встраиваемый режим
- Минимальный функционал
- Легкий вес
- Простая интеграция
- [MicroEditor.tsx](src/components/Editor/MicroEditor.tsx)


### Панели инструментов

| Компонент | Назначение |
|-----------|------------|
| `FullBubbleMenu` | Полная панель форматирования |
| `MicroBubbleMenu` | Базовое форматирование |
| `BlockquoteBubbleMenu` | Управление цитатами |
| `FigureBubbleMenu` | Управление изображениями |
| `IncutBubbleMenu` | Управление врезками |
| `EditorFloatingMenu` | Плавающее меню |

### Возможности форматирования

| Функция | Описание | Компонент |
|---------|-----------|-----------|
| Текст | Базовое форматирование | `MicroBubbleMenu` |
| Заголовки | H1-H3 | `FullBubbleMenu` |
| Списки | Маркированные и нумерованные | `FullBubbleMenu` |
| Цитаты | Обычные и врезки | `BlockquoteBubbleMenu` |
| Изображения | С подписями и выравниванием | `FigureBubbleMenu` |
| Сноски | С редактором | `FullBubbleMenu` |
| Врезки | С фоном и выравниванием | `IncutBubbleMenu` |

## Контекст редактора

Редактор использует `EditorContext` для:
- Управления состоянием
- Автосохранения
- Коллаборативного режима
- Валидации контента

```typescript
const {
    isReady, // Готовность редактора
    isCollabMode, // Режим коллаборации
    saving, // Статус сохранения
    hasChanges, // Наличие изменений
    form, // Данные формы
    editing // Экземпляр редактора
} = useEditorContext()
```


## Тестирование

```typescript
test('Editor initialization', async ({ page }) => {
    await page.goto('/edit/new')
    await expect(page.locator('[data-ready="true"]')).toBeVisible()
})
```

## Стилизация

Редактор использует CSS модули для стилизации:
- `Editor.module.scss` - Основные стили
- `BubbleMenu.module.scss` - Стили панелей
- `MiniEditor.module.scss` - Стили мини-редактора

### CSS модули
- [Editor.module.scss](src/components/Editor/Editor.module.scss)
- [MiniEditor.module.scss](src/components/Editor/MiniEditor.module.scss)
- [Toolbar.module.scss](src/components/Editor/Toolbar/Toolbar.module.scss)

### Темы
- [themes/light.scss](src/styles/themes/light.scss)
- [themes/dark.scss](src/styles/themes/dark.scss)

## Полезные ссылки

- [TipTap Documentation](https://tiptap.dev/docs)
- [SolidJS Components](https://www.solidjs.com/docs/latest/api#components)
- [ProseMirror Guide](https://prosemirror.net/docs/guide/)
