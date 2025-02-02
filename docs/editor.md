
# Редактор discours.io

## Типы редакторов

| Тип | Назначение | Компонент |
|-----|------------|-----------|
| Полный редактор | Редактирование статей | `EditorComponent` |
| Мини-редактор | Редактирование коротких текстов | `MiniEditor` |
| Микро-редактор | Встраиваемый редактор | `MicroEditor` |

## Архитектура редактора

### 1. Основные компоненты

```
Editor/
├── Editor.tsx # Основной редактор
├── MiniEditor.tsx # Упрощенная версия
├── MicroEditor.tsx # Минимальная версия
├── Panel/ # Панель управления
├── Toolbar/ # Панели инструментов
└── extensions/ # Расширения TipTap
```

### 2. Панели инструментов

| Компонент | Назначение |
|-----------|------------|
| `FullBubbleMenu` | Полная панель форматирования |
| `MicroBubbleMenu` | Базовое форматирование |
| `BlockquoteBubbleMenu` | Управление цитатами |
| `FigureBubbleMenu` | Управление изображениями |
| `IncutBubbleMenu` | Управление врезками |
| `EditorFloatingMenu` | Плавающее меню |

### 3. Возможности форматирования

| Функция | Описание | Компонент |
|---------|-----------|-----------|
| Текст | Базовое форматирование | `MicroBubbleMenu` |
| Заголовки | H1-H3 | `FullBubbleMenu` |
| Списки | Маркированные и нумерованные | `FullBubbleMenu` |
| Цитаты | Обычные и врезки | `BlockquoteBubbleMenu` |
| Изображения | С подписями и выравниванием | `FigureBubbleMenu` |
| Сноски | С редактором | `FullBubbleMenu` |
| Врезки | С фоном и выравниванием | `IncutBubbleMenu` |

### 4. Режимы работы

| Режим | Описание | Компоненты |
|-------|-----------|------------|
| Обычный | Одиночное редактирование | `EditorComponent` |
| Коллаборативный | Совместное редактирование | `EditorComponent + Collaboration` |
| Автосохранение | Сохранение черновиков | `AutoSaveNotice` |

## Расширение функционала

### 1. Добавление нового типа контента

```typescript
// 1. Создать расширение в extensions/
import { Node } from '@tiptap/core'
export const CustomNode = Node.create({
name: 'customNode',
group: 'block',
content: 'block+',
// Определить HTML представление
parseHTML() { ... },
renderHTML() { ... },
// Добавить атрибуты
addAttributes() { ... },
// Добавить команды
addCommands() { ... }
})
// 2. Подключить в Editor.tsx
extensions: [
...base,
CustomNode
]
```

### 2. Добавление панели инструментов

```typescript
// 1. Создать компонент в Toolbar/
export const CustomBubbleMenu = (props: Props) => {
return (
<div class={styles.BubbleMenu}>
<ToolbarControl
editor={props.editor}
onChange={() => {
// Обработка действий
}}
/>
</div>
)
}
// 2. Подключить в Editor.tsx
BubbleMenu.configure({
element: customBubbleMenuRef()!,
shouldShow: ({ editor }) => {
// Условия отображения
}
})
```

### 3. Добавление горячих клавиш

```typescript
// В Editor.tsx
addKeyboardShortcuts() {
    return {
        'Mod-K': () => this.editor.commands.customCommand(),
        'Mod-Shift-K': () => this.editor.commands.anotherCommand()
        }
    }
```

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

## Стилизация

Редактор использует CSS модули для стилизации:
- `Editor.module.scss` - Основные стили
- `BubbleMenu.module.scss` - Стили панелей
- `MiniEditor.module.scss` - Стили мини-редактора

## Тестирование

```typescript
test('Editor initialization', async ({ page }) => {
await page.goto('/edit/new')
await expect(page.locator('[data-ready="true"]')).toBeVisible()
})
```
