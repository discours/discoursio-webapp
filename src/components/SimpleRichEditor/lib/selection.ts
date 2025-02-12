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
 *
 * @example
 * ```ts
 * const selection = saveSelection()
 * // ... выполняем операции
 * restoreSelection(selection)
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

  return {
    saveSelection,
    restoreSelection,
    updateActiveFormats,
    activeFormats,
    menuPosition,
    isSelectionInEditor
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
