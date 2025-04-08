import { Position } from './types'

/**
 * Прокручивает страницу к нужному элементу редактора
 * @param element Элемент для прокрутки
 * @param offsetTop Смещение сверху
 */
export const scrollToElement = (element: HTMLElement, offsetTop = 0): void => {
  if (!element) return

  const rect = element.getBoundingClientRect()
  window.scrollTo({
    top: window.scrollY + rect.top - offsetTop,
    behavior: 'smooth'
  })
}

/**
 * Получает позицию курсора в редакторе
 * @param editor Ссылка на редактор
 * @returns Позиция курсора или null
 */
export const getCursorPosition = (editor: HTMLElement | null): Position | null => {
  if (!editor || typeof window === 'undefined') return null

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const editorRect = editor.getBoundingClientRect()

  // Получаем координаты начала диапазона
  const rect = range.getClientRects()[0] || range.getBoundingClientRect()

  if (rect) {
    return {
      top: rect.top - editorRect.top,
      left: rect.left - editorRect.left
    }
  }

  return null
}

/**
 * Проверяет, находится ли выделение внутри элемента
 * @param element Элемент для проверки
 * @returns true если выделение внутри элемента
 */
export const isSelectionInElement = (element: HTMLElement | null): boolean => {
  if (!element || typeof window === 'undefined') return false

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  return element.contains(range.commonAncestorContainer)
}

/**
 * Отслеживает выделение и позицию курсора
 *
 * @param params Параметры для отслеживания
 */
export const trackSelectionAndCursor = ({
  isServer,
  editorRef,
  updateActiveFormats,
  isSelectionInEditor,
  setSelection,
  setCursorPosition,
  setToolbar,
  isEmptyContent,
  toolbarMode,
  editorId // Опциональный идентификатор редактора
}: {
  isServer: boolean
  editorRef: () => HTMLElement | undefined
  updateActiveFormats: () => void
  isSelectionInEditor: () => boolean
  setSelection: (sel: { text: string; isEmpty: boolean }) => void
  setCursorPosition: (pos: Position | null) => void
  setToolbar: (mode: string) => void
  isEmptyContent: (content: string) => boolean
  toolbarMode: string
  editorId?: string
}): void => {
  if (isServer) return

  const selection = window.getSelection()
  if (!selection) return

  // Проверяем, что выделение действительно в этом редакторе
  const currentEditor = editorRef()
  if (!currentEditor) return

  // Проверяем, что выделение или курсор находится именно в этом редакторе
  const isInCurrentEditor = isSelectionInEditor()

  // Если выделение не в текущем редакторе, возвращаемся
  if (!isInCurrentEditor) {
    return
  }

  // Обновляем состояние активных форматов при изменении выделения
  updateActiveFormats()

  // Проверяем, пустое ли выделение
  const isEmpty = selection.toString().length === 0

  // Сохраняем информацию о выделении
  const text = isEmpty ? '' : selection.toString()
  setSelection({ text, isEmpty })

  // Определяем позицию выделения для меню
  if (isSelectionInEditor() && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)

    // Получаем координаты начала диапазона
    const rect = range.getClientRects()[0] || range.getBoundingClientRect()

    if (rect) {
      // Получаем координаты редактора
      const editor = editorRef()
      if (editor) {
        const editorRect = editor.getBoundingClientRect()
        // Вычисляем относительные координаты внутри редактора
        const position = {
          top: rect.top - editorRect.top,
          left: rect.left + rect.width / 2 - editorRect.left
        }
        setCursorPosition(position)

        // Сохраняем последнюю позицию курсора в localStorage для восстановления, если есть ID редактора
        if (editorId) {
          try {
            const editorState = {
              cursorPosition: position,
              timestamp: Date.now()
            }
            localStorage.setItem(`editor-cursor-${editorId}`, JSON.stringify(editorState))
          } catch (e) {
            console.warn('[trackSelectionAndCursor] Error saving cursor position:', e)
          }
        }
      } else {
        // Если не можем получить редактор, используем абсолютные координаты
        const position = {
          top: rect.top,
          left: rect.left + rect.width / 2
        }
        setCursorPosition(position)
      }
    }

    // Управляем видимостью тулбара в режиме float
    if (toolbarMode === 'float') {
      if (isEmpty) {
        setToolbar('hidden')
      } else {
        setToolbar('float')
      }
    }
  } else if (currentEditor && isEmptyContent(currentEditor.innerHTML)) {
    // Если редактор пустой, устанавливаем позицию курсора в середину редактора
    const editorRect = currentEditor.getBoundingClientRect()
    const position = {
      top: editorRect.height / 2,
      left: 10 // Небольшой отступ от левого края
    }
    setCursorPosition(position)

    // Сохраняем позицию даже когда редактор пустой, если есть ID
    if (editorId) {
      try {
        const editorState = {
          cursorPosition: position,
          timestamp: Date.now(),
          isEmpty: true
        }
        localStorage.setItem(`editor-cursor-${editorId}`, JSON.stringify(editorState))
      } catch (e) {
        console.warn('[trackSelectionAndCursor] Error saving empty cursor position:', e)
      }
    }
  }
}

/**
 * Заменяет текущее выделение HTML контентом
 * @param html HTML строка для вставки
 * @param editor Ссылка на редактор
 * @returns true если замена успешна
 */
export const replaceSelection = (html: string, editor: HTMLElement | null): boolean => {
  if (!editor || typeof window === 'undefined') return false

  // Получаем текущее выделение
  const selection = window.getSelection()
  if (!selection) return false

  // Если нет выделения, создаем новое в конце редактора
  if (!selection.rangeCount) {
    const range = document.createRange()

    // Если есть текст в редакторе, ставим курсор в конец
    if (editor.lastChild) {
      range.selectNodeContents(editor)
      range.collapse(false)
    } else {
      // Иначе выбираем весь редактор
      range.selectNodeContents(editor)
    }

    selection.removeAllRanges()
    selection.addRange(range)
  }

  // Теперь должно быть доступно выделение
  if (!selection.rangeCount) {
    console.error('Не удалось создать выделение в редакторе')
    return false
  }

  const range = selection.getRangeAt(0)

  // Создаем временный контейнер для HTML
  const temp = document.createElement('div')
  temp.innerHTML = html

  // Очищаем текущее выделение
  range.deleteContents()

  // Вставляем новый контент
  const fragment = document.createDocumentFragment()
  while (temp.firstChild) {
    fragment.appendChild(temp.firstChild)
  }

  range.insertNode(fragment)

  // Перемещаем курсор в конец вставленного контента
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)

  return true
}

/**
 * Перемещает курсор в конец редактора
 * @param editor Ссылка на редактор
 */
export const moveCursorToEnd = (editor: HTMLElement | null): void => {
  if (!editor || typeof window === 'undefined') return

  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()

  if (editor.lastChild) {
    range.selectNodeContents(editor.lastChild)
    range.collapse(false)
  } else {
    range.selectNodeContents(editor)
    range.collapse(false)
  }

  selection.removeAllRanges()
  selection.addRange(range)
}

export const createEditorConfig = ({
  isServer,
  isEmptyContent,
  toolbarMode,
  editorId // Опциональный идентификатор редактора
}: {
  isServer: boolean
  isEmptyContent: (content: string) => boolean
  toolbarMode?: 'fixed' | 'floating' | 'bottom' | 'none'
  editorId?: string
}) => {
  // Получаем сохраненные настройки для этого редактора, если они есть
  let savedConfig = {}
  if (!isServer && editorId) {
    try {
      const savedConfigStr = localStorage.getItem(`editor-config-${editorId}`)
      if (savedConfigStr) {
        savedConfig = JSON.parse(savedConfigStr)
        console.log(`[EditorConfig] Loaded config for editor ${editorId}`, savedConfig)
      }
    } catch (e) {
      console.warn('[EditorConfig] Error loading saved config:', e)
    }
  }

  // Объединяем со стандартными настройками
  return {
    // Базовые настройки
    toolbarMode: toolbarMode || 'fixed',
    placeholder: '',

    // Вспомогательные функции
    isEmptyContentFn: isEmptyContent,

    // Сохраненные пользовательские настройки
    ...savedConfig
  }
}
