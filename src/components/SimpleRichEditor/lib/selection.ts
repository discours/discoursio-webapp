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
 * - Обработка изменений выделения
 * - Проверка нахождения выделения внутри элемента
 * - Получение координат курсора
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
 * Хук для работы с выделением текста
 *
 * @param editorRef Реф на редактор
 * @returns Методы для работы с выделением
 */
export const useSelection = (editorRef: Accessor<HTMLDivElement | undefined>) => {
  const [savedRange, setSavedRange] = createSignal<Range | null>(null)
  const [activeFormats, setActiveFormats] = createSignal<Set<CommandType>>(new Set())

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

    const rect = selection.getRangeAt(0).getBoundingClientRect()
    const formats = new Set<CommandType>()
    Object.entries(MENU_GROUPS).forEach(([_group, commands]) => {
      commands.forEach((cmd) => {
        if (
          hasFormatting(cmd as CommandType, {
            range: selection.getRangeAt(0),
            text: selection.toString(),
            isEmpty: selection.toString().length === 0,
            position: {
              top: rect.top,
              left: rect.left + rect.width / 2
            }
          })
        ) {
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
