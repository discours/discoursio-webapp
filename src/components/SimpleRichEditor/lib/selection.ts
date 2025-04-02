import { Accessor, createSignal } from 'solid-js'
import { CommandType, MENU_GROUPS } from './commands'
import { hasFormatting } from './format'
import { Position } from './types'

/**
 * @module selection
 * @description Модуль для работы с выделением текста
 *
 * Функционал:
 * - Сохранение/восстановление выделения
 * - Получение информации о выделении
 * - Позиционирование меню относительно выделения
 * - Обработка изменений выделения
 * - Проверка нахождения выделения внутри элемента
 * - Получение координат курсора
 * - Расчет позиции для всплывающих меню
 *
 * @example
 * ```ts
 * // Сохранение и восстановление выделения
 * const selection = saveSelection()
 * // ... выполняем операции
 * restoreSelection(selection)
 *
 * // Проверка нахождения выделения внутри элемента
 * if (isSelectionInElement(editor)) {
 *   // Выделение внутри редактора
 * }
 *
 * // Получение позиции для меню
 * const position = getMenuPosition(editor, isEmptyContent)
 * ```
 */

export const filterTextNodes = (nodes: Node[]): Text[] =>
  nodes.filter((node): node is Text => node.nodeType === Node.TEXT_NODE)

export interface SelectionState {
  range: Range | null
  text: string
  isEmpty: boolean
  position: {
    top: number
    left: number
  }
}

export interface EditorSelection {
  text: string
  isEmpty: boolean
  position?: Position
}

/**
 * Вычисляет позицию и смещение для Range
 */
export const getRangeArgs = (pos: number, textNodes: Text[]): [Text, number] => {
  let currentPos = 0

  for (const node of textNodes) {
    const length = node.length
    if (currentPos + length >= pos) {
      return [node, pos - currentPos]
    }
    currentPos += length
  }

  // Возвращаем последний узел если позиция за пределами
  return [textNodes[textNodes.length - 1], textNodes[textNodes.length - 1].length]
}

/**
 * Получает позицию в текстовых узлах для контейнера и смещения
 */
export const getRangePos = (container: Node, offset: number, textNodes: Text[]): [Text, number] => {
  if (container.nodeType === Node.TEXT_NODE) {
    const nodeIndex = textNodes.indexOf(container as Text)
    if (nodeIndex !== -1) {
      return [container as Text, offset]
    }
  }

  // Для элемента ищем текстовый узел по смещению
  const targetNode = textNodes[offset] || textNodes[textNodes.length - 1]
  return [targetNode, 0]
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
 * Получает позицию курсора в редакторе
 * @param editor Редактор
 * @returns Позиция курсора относительно редактора или null
 */
export const getCursorPosition = (editor: HTMLElement | null): Position | null => {
  if (!editor || typeof window === 'undefined') return null

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)

  // Проверяем, что выделение внутри редактора
  if (!editor.contains(range.commonAncestorContainer)) return null

  const editorRect = editor.getBoundingClientRect()

  // Получаем координаты выделения
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
 * Получает позицию для отображения всплывающего меню
 * @param editor Редактор
 * @param isEmptyContent Функция для проверки пустого содержимого
 * @returns Объект с позицией и флагом видимости
 */
export const getMenuPosition = (
  editor: HTMLElement | null
): { top: number; left: number; isVisible: boolean } => {
  if (!editor) {
    return { top: 0, left: 0, isVisible: false }
  }

  // Получаем размеры и положение редактора
  const editorRect = editor.getBoundingClientRect()
  const scrollTop = window.scrollY || document.documentElement.scrollTop

  // Определяем текущую позицию курсора
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    // Проверяем, что курсор находится внутри редактора
    if (editor.contains(range.commonAncestorContainer as Node)) {
      // Возвращаем точную позицию курсора
      return {
        top: rect.top + scrollTop, // Учитываем скролл
        left: rect.left, // Точное положение курсора по горизонтали
        isVisible: true // Показываем меню когда есть редактор и курсор
      }
    }
  }

  // Если позиции курсора нет, позиционируем по центру высоты редактора
  return {
    top: editorRect.top + scrollTop + editorRect.height / 2, // Середина редактора
    left: editorRect.left + 10, // Небольшой отступ от левого края
    isVisible: true // В пустом редакторе всегда показываем меню
  }
}

/**
 * Рассчитывает позицию для отображения всплывающего меню относительно выделения
 * @param editor Редактор или активная кнопка
 * @returns Позиция меню или undefined
 */
export const calculateMenuPosition = (
  editorRef: HTMLElement | null
): { top: number; left: number } | undefined => {
  if (!editorRef) return undefined

  // Пытаемся найти активный элемент в тулбаре (кнопку, которая была нажата)
  const activeButton = document.querySelector('.SimpleRichEditor_active__control')
  if (activeButton) {
    const rect = activeButton.getBoundingClientRect()
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft
    return {
      top: rect.top + scrollTop,
      left: rect.left + scrollLeft
    }
  }

  // Если кнопка не найдена, используем позицию курсора
  const windowSelection = window.getSelection()
  if (windowSelection?.rangeCount) {
    const range = windowSelection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft
    return {
      top: rect.bottom + scrollTop + 5, // Немного ниже курсора
      left: rect.left + scrollLeft
    }
  }

  // Если ничего не найдено, позиционируем по центру редактора
  if (editorRef) {
    const rect = editorRef.getBoundingClientRect()
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft
    return {
      top: rect.top + scrollTop + 50,
      left: rect.left + scrollLeft + rect.width / 2 - 140 // приблизительно половина ширины формы
    }
  }

  return undefined
}

/**
 * Хук для работы с выделением текста
 *
 * @param editorRef Реф на редактор
 * @returns Методы для работы с выделением
 */
export const useSelection = (editorRef: Accessor<HTMLDivElement | undefined>) => {
  const [savedRange, setSavedRange] = createSignal<Range | null>(null)
  const [activeFormats, setActiveFormats] = createSignal<Set<CommandType>>(new Set())

  // Add position tracking for menu
  const [menuPosition, setMenuPosition] = createSignal<Position>({ top: 0, left: 0 })

  const isSelectionInEditor = () => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return false

    const range = selection.getRangeAt(0)
    const editor = editorRef()
    if (!editor) return false

    // Проверяем, что выделение полностью внутри редактора
    return editor.contains(range.commonAncestorContainer)
  }

  const saveSelection = () => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !isSelectionInEditor()) {
      setSavedRange(null)
      return false
    }

    const range = selection.getRangeAt(0)
    setSavedRange(range.cloneRange())
    return true
  }

  /**
   * Восстанавливает сохраненное выделение
   * @returns true если выделение восстановлено
   */
  const restoreSelection = () => {
    const range = savedRange()
    if (!range || !isSelectionInEditor()) {
      return false
    }

    try {
      const selection = window.getSelection()
      if (!selection) return false

      selection.removeAllRanges()
      selection.addRange(range.cloneRange())
      return true
    } catch (error) {
      console.error('Error restoring selection:', error)
      return false
    }
  }

  /**
   * Обновляет состояние активных форматов
   */
  const updateActiveFormats = () => {
    const selection = window.getSelection()
    if (!selection || !editorRef()) return

    // Update menu position when selection changes
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setMenuPosition({
        top: rect.top - 10,
        left: rect.left + rect.width / 2
      })
    }

    const formats = new Set<CommandType>()
    Object.entries(MENU_GROUPS).forEach(([_group, commands]) => {
      commands.forEach((cmd) => {
        if (hasFormatting(cmd as CommandType, selection)) {
          formats.add(cmd as CommandType)
        }
      })
    })

    setActiveFormats(formats)
    return formats
  }

  /**
   * Получает информацию о текущем выделении
   * @returns Объект с информацией о выделении
   */
  const getSelectionInfo = (): EditorSelection => {
    const selection = window.getSelection()
    if (!selection) return { text: '', isEmpty: true }

    const text = selection.toString()
    const isEmpty = text.length === 0

    if (selection.rangeCount > 0 && isSelectionInEditor()) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      return {
        text,
        isEmpty,
        position: {
          top: rect.top,
          left: rect.left + rect.width / 2
        }
      }
    }

    return { text, isEmpty }
  }

  return {
    saveSelection,
    restoreSelection,
    updateActiveFormats,
    activeFormats,
    menuPosition,
    isSelectionInEditor,
    getSelectionInfo
  }
}

/**
 * Проверяет активность ссылки в текущем выделении
 */
export const isLinkActive = () => {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return false

  const range = sel.getRangeAt(0)
  const commonAncestor = range.commonAncestorContainer
  return !!(commonAncestor.nodeType === Node.ELEMENT_NODE
    ? (commonAncestor as Element).closest('a')
    : commonAncestor.parentElement?.closest('a'))
}
