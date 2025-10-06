/**
 * @module lib/selection
 * @description Единый модуль для работы с выделением текста (объединяет selection.ts и selection.ts)
 *
 * Функционал:
 * - Валидация и создание SelectionState
 * - Сохранение/восстановление выделения
 * - Поиск родительских элементов (ссылки, блоки)
 * - Проверка типов блоков и выделения
 * - Отслеживание изменений выделения
 * - Получение координат курсора
 */

import { Accessor, createEffect, createSignal } from 'solid-js'
import { isServer } from 'solid-js/web'
import { debounce } from 'throttle-debounce'
import { MENU_GROUPS } from '../menu/config'
import { isEmptyContent } from './empty'
import { CommandGroupType, CommandType, Position, SelectionState } from './types'
import { getCursorPosition, trackSelectionAndCursor } from './utils'

// ============================================================================
// ТИПЫ И ИНТЕРФЕЙСЫ
// ============================================================================

/**
 * Результат валидации выделения
 */
export interface SelectionValidationResult {
  isValid: boolean
  selection: Selection | null
  range: Range | null
  error?: string
}

export interface EditorSelection {
  text: string
  isEmpty: boolean
  position?: Position
}

// ============================================================================
// ВАЛИДАЦИЯ И СОЗДАНИЕ SELECTION STATE
// ============================================================================

/**
 * Валидирует текущее выделение в редакторе
 * Консолидирует логику из SimpleRichEditor.tsx, handlers/forms.ts, lib/actions.ts
 *
 * @param editor - DOM элемент редактора
 * @returns Результат валидации с selection и range или ошибкой
 */
export const validateSelection = (editor: HTMLElement | null | undefined): SelectionValidationResult => {
  if (!editor) {
    return {
      isValid: false,
      selection: null,
      range: null,
      error: 'Editor not found'
    }
  }

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return {
      isValid: false,
      selection: null,
      range: null,
      error: 'No selection available'
    }
  }

  const range = selection.getRangeAt(0)

  // Проверяем, что выделение находится внутри редактора
  if (!editor.contains(range.commonAncestorContainer)) {
    return {
      isValid: false,
      selection,
      range,
      error: 'Selection is not within editor'
    }
  }

  return {
    isValid: true,
    selection,
    range,
    error: undefined
  }
}

/**
 * Создает SelectionState из текущего выделения
 *
 * @param editor - DOM элемент редактора
 * @param cursorPosition - Текущая позиция курсора (опционально)
 * @returns SelectionState или null если выделение невалидно
 */
export const createSelectionState = (
  editor: HTMLElement | null | undefined,
  cursorPosition?: Position | null
): SelectionState | null => {
  const validation = validateSelection(editor)

  if (!validation.isValid || !validation.selection || !validation.range) {
    console.warn('[createSelectionState] Invalid selection:', validation.error)
    return null
  }

  return {
    range: validation.range,
    text: validation.selection.toString(),
    isEmpty: validation.selection.isCollapsed,
    position: cursorPosition || { top: 0, left: 0 }
  }
}

// ============================================================================
// ПОИСК РОДИТЕЛЬСКИХ ЭЛЕМЕНТОВ
// ============================================================================

// Реэкспорт базовых DOM утилит (избегаем циклических зависимостей)
export { findAncestor, getElementFromNode } from './dom-utils'

/**
 * Находит родительский элемент ссылки для текущего узла
 * Консолидирует логику из handlers/ui.ts и handlers/forms.ts
 *
 * @param node - Начальный узел для поиска
 * @param rootNode - Корневой узел (редактор), за пределы которого не выходить
 * @returns HTMLAnchorElement или null
 */
export const findLinkAncestor = (
  node: Node | null,
  rootNode: HTMLElement | null | undefined
): HTMLAnchorElement | null => {
  if (!node || !rootNode) return null

  let currentNode: Node | null = node

  while (currentNode && currentNode !== rootNode) {
    if (currentNode.nodeName === 'A') {
      return currentNode as HTMLAnchorElement
    }

    // Останавливаемся если достигли body (безопасность)
    if (!currentNode.parentNode || currentNode.parentNode === document.body) {
      break
    }

    currentNode = currentNode.parentNode
  }

  return null
}

/**
 * Находит родительский блочный элемент для текущего узла
 * Консолидирует логику из keyboard.ts, SimpleRichEditor.tsx, events.ts
 *
 * @param node - Начальный узел для поиска
 * @param rootNode - Корневой узел (редактор)
 * @returns HTMLElement блочного элемента или null
 */
export const findBlockAncestor = (node: Node | null, rootNode: HTMLElement | null | undefined): HTMLElement | null => {
  if (!node || !rootNode) return null

  let currentNode: Node | null = node

  // Если это текстовый узел, начинаем с родителя
  if (currentNode.nodeType === Node.TEXT_NODE) {
    currentNode = currentNode.parentElement
  }

  while (currentNode && currentNode !== rootNode) {
    if (currentNode instanceof HTMLElement) {
      const tagName = currentNode.tagName

      // Проверяем блочные элементы
      if (
        tagName === 'BLOCKQUOTE' ||
        tagName === 'H1' ||
        tagName === 'H2' ||
        tagName === 'H3' ||
        tagName === 'H4' ||
        tagName === 'H5' ||
        tagName === 'H6' ||
        tagName === 'UL' ||
        tagName === 'OL' ||
        tagName === 'P' ||
        (tagName === 'DIV' && (currentNode.hasAttribute('data-type') || currentNode.hasAttribute('data-align')))
      ) {
        return currentNode
      }
    }

    if (!currentNode.parentNode) break
    currentNode = currentNode.parentNode
  }

  return null
}

/**
 * Находит ближайший блочный элемент для node (более простая версия findBlockAncestor)
 * Используется для проверки выделения блока
 *
 * @param node - Узел для поиска
 * @param editorRoot - Корневой узел редактора
 * @returns HTMLElement блочного элемента или null
 */
export const getBlockElement = (node: Node, editorRoot: HTMLElement): HTMLElement | null => {
  let current: Node | null = node

  while (current && current !== editorRoot) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as HTMLElement
      const tagName = element.tagName.toLowerCase()

      // Блочные элементы
      if (['p', 'h1', 'h2', 'h3', 'blockquote', 'div', 'li'].includes(tagName)) {
        return element
      }
    }
    current = current.parentNode
  }

  return null
}

// ============================================================================
// ПРОВЕРКИ ТИПОВ БЛОКОВ И ВЫДЕЛЕНИЯ
// ============================================================================

/**
 * Проверяет, является ли узел или его родитель блочным элементом определенного типа
 *
 * @param node - Узел для проверки
 * @param blockType - Тип блочного элемента (например, 'blockquote', 'h1')
 * @param rootNode - Корневой узел (редактор)
 * @returns true если узел находится внутри блока указанного типа
 */
export const isInsideBlockType = (
  node: Node | null,
  blockType: string,
  rootNode: HTMLElement | null | undefined
): boolean => {
  const blockElement = findBlockAncestor(node, rootNode)
  if (!blockElement) return false

  const normalizedType = blockType.toUpperCase()

  // Для div с атрибутами проверяем data-type или data-align
  if (normalizedType === 'INCUT' || normalizedType === 'PUNCHLINE') {
    return blockElement.tagName === 'DIV' && blockElement.hasAttribute('data-align')
  }

  return blockElement.tagName === normalizedType
}

/**
 * Проверяет, выделен ли весь блок полностью
 * Блочное форматирование применяется только если:
 * 1. Курсор находится в блоке без выделения (isEmpty: true)
 * 2. Весь текст блока выделен полностью
 *
 * @param range - Range объект выделения
 * @param editorRoot - Корневой элемент редактора
 * @returns true если весь блок выделен или курсор в блоке
 */
export const isFullBlockSelected = (range: Range, editorRoot: HTMLElement): boolean => {
  if (!range || !editorRoot) return false

  // Если нет выделения (collapsed) - это курсор в блоке
  if (range.collapsed) {
    return true // Курсор = блочное форматирование разрешено
  }

  // Есть выделение - проверяем, выделен ли весь блок
  const startContainer = range.startContainer
  const endContainer = range.endContainer

  // Находим блочный элемент для начала и конца выделения
  const startBlock = getBlockElement(startContainer, editorRoot)
  const endBlock = getBlockElement(endContainer, editorRoot)

  // Если начало и конец в разных блоках - это не полное выделение блока
  if (startBlock !== endBlock) {
    return false
  }

  // Если блок не найден
  if (!startBlock) {
    return false
  }

  // Проверяем, что выделен весь текст блока
  const blockText = startBlock.textContent || ''
  const selectedText = range.toString()

  // Если выделенный текст равен всему тексту блока - это полное выделение
  return blockText === selectedText
}

/**
 * Определяет, должна ли команда применяться как блочное форматирование
 *
 * @param command - Команда для проверки
 * @param range - Range объект выделения
 * @param editorRoot - Корневой элемент редактора
 * @returns true если команда должна применяться как блочное форматирование
 */
export const shouldApplyBlockFormatting = (command: string, range: Range, editorRoot: HTMLElement): boolean => {
  // Список блочных команд
  const blockCommands = ['h1', 'h2', 'h3', 'blockquote', 'p', 'punchline', 'incut']

  // Если это не блочная команда - false
  if (!blockCommands.includes(command)) {
    return false
  }

  // Incut - особая команда-контейнер, применяется всегда к текущему блоку
  // независимо от выделения
  if (command === 'incut') {
    return true
  }

  // Для остальных блочных команд проверяем, выделен ли весь блок
  return isFullBlockSelected(range, editorRoot)
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

// ============================================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С ТЕКСТОВЫМИ УЗЛАМИ
// ============================================================================

export const filterTextNodes = (nodes: Node[]): Text[] =>
  nodes.filter((node): node is Text => node.nodeType === Node.TEXT_NODE)

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

// ============================================================================
// ЛОГИРОВАНИЕ И ОТЛАДКА
// ============================================================================

/**
 * Логирует детали выделения для отладки
 *
 * @param selection - Объект Selection
 * @param context - Контекст вызова (для логов)
 */
export const logSelectionDetails = (selection: Selection, context: string): void => {
  if (!selection.rangeCount) {
    console.log(`[${context}] No ranges in selection`)
    return
  }

  const range = selection.getRangeAt(0)

  console.log(`[${context}] Selection details:`, {
    text: selection.toString(),
    isCollapsed: selection.isCollapsed,
    rangeCount: selection.rangeCount,
    startContainer: range.startContainer.nodeName,
    endContainer: range.endContainer.nodeName,
    startOffset: range.startOffset,
    endOffset: range.endOffset
  })
}

// ============================================================================
// ХУК ДЛЯ РАБОТЫ С ВЫДЕЛЕНИЕМ
// ============================================================================

/**
 * Расширенный хук для работы с выделением, курсором и состоянием тулбара.
 *
 * @param editorRef Accessor для div элемента редактора.
 * @param toolbarMode Accessor для текущего режима тулбара из props.
 * @param editorId Accessor для ID редактора (опционально).
 * @returns Объект с состоянием выделения, курсора, форматов, тулбара и функциями управления.
 */
export const useSelection = (
  editorRef: Accessor<HTMLDivElement | undefined>,
  toolbarMode: Accessor<string>,
  editorId?: Accessor<string | undefined>
) => {
  const [savedRange, setSavedRange] = createSignal<Range | null>(null)
  const [activeFormats, setActiveFormats] = createSignal<Set<CommandType>>(new Set())

  const [selectionInfo, setSelectionInfo] = createSignal<{ text: string; isEmpty: boolean }>({
    text: '',
    isEmpty: true
  })
  const [cursorPosition, setCursorPosition] = createSignal<Position | null>(null)
  const [toolbarSignal, setToolbarSignal] = createSignal<string>('hidden')

  const isSelectionInEditor = () => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return false
    const range = selection.getRangeAt(0)
    const editor = editorRef()
    return editor ? editor.contains(range.commonAncestorContainer) : false
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

  const restoreSelection = () => {
    const range = savedRange()
    if (!range || typeof window === 'undefined') return false
    try {
      const selection = window.getSelection()
      if (!selection) return false
      selection.removeAllRanges()
      selection.addRange(range.cloneRange())
      return isSelectionInEditor()
    } catch (error) {
      console.error('Error restoring selection:', error)
      return false
    }
  }

  const updateActiveFormats = async () => {
    try {
      const selection = window.getSelection()
      const editor = editorRef()
      if (!selection || !selection.rangeCount || !editor || !isSelectionInEditor()) {
        setActiveFormats(new Set<CommandType>([]))
        return activeFormats()
      }

      const range = selection.getRangeAt(0)
      if (!range) {
        setActiveFormats(new Set<CommandType>([]))
        return activeFormats()
      }

      const rect = range.getBoundingClientRect()
      const computedFormats = new Set<CommandType>()

      if (!MENU_GROUPS) {
        console.warn('[SimpleRichEditor] MENU_GROUPS is undefined')
        return activeFormats()
      }

      // Динамический импорт для избежания циклической зависимости
      const { hasFormatting } = await import('../format/detection')

      Object.keys(MENU_GROUPS).forEach((groupKey: string) => {
        if (!MENU_GROUPS[groupKey as CommandGroupType]) return

        const commandsInGroup: readonly CommandType[] = MENU_GROUPS[groupKey as CommandGroupType]
        if (!Array.isArray(commandsInGroup)) return

        commandsInGroup.forEach((cmd: CommandType) => {
          if (!cmd) return

          const currentState: SelectionState = {
            range: range,
            text: selection.toString(),
            isEmpty: selection.isCollapsed,
            position: {
              top: rect.top,
              left: rect.left + rect.width / 2
            }
          }

          if (hasFormatting(cmd, currentState)) {
            computedFormats.add(cmd)
          }
        })
      })

      const currentFormatsValue = activeFormats()
      if (
        computedFormats.size !== currentFormatsValue.size ||
        ![...computedFormats].every((format) => currentFormatsValue.has(format))
      ) {
        setActiveFormats(computedFormats)
      }

      return activeFormats()
    } catch (error) {
      console.error('[SimpleRichEditor] Error in updateActiveFormats:', error)
      return activeFormats()
    }
  }

  const getSelectionText = () => selectionInfo().text

  const handleTrackSelectionAndCursor = () => {
    try {
      trackSelectionAndCursor({
        isServer: isServer,
        editorRef: editorRef,
        updateActiveFormats: updateActiveFormats,
        isSelectionInEditor: isSelectionInEditor,
        setSelection: setSelectionInfo,
        setCursorPosition: setCursorPosition,
        setToolbar: setToolbarSignal,
        isEmptyContent: isEmptyContent,
        toolbarMode: toolbarMode(),
        editorId: editorId ? editorId() : undefined
      })
    } catch (error) {
      console.error('[SimpleRichEditor] Error in trackSelectionAndCursor:', error)
    }
  }

  createEffect(() => {
    const currentToolbarMode = toolbarMode()
    const info = selectionInfo()

    if (currentToolbarMode === 'float') {
      setToolbarSignal(info.text && !info.isEmpty ? 'float' : 'hidden')
    }
  })

  return {
    saveSelection,
    restoreSelection,
    updateActiveFormats,
    activeFormats,
    isSelectionInEditor,
    selectionInfo,
    getSelectionText,
    cursorPosition,
    toolbarSignal,
    handleTrackSelectionAndCursor
  }
}

// ============================================================================
// ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ ВЫДЕЛЕНИЯ
// ============================================================================

/**
 * Настраивает отслеживание выделения в редакторе
 *
 * @param editor DOM-элемент редактора
 * @param onSelectionChange Колбэк, вызываемый при изменении выделения
 * @returns Функции cleanup для отключения отслеживания
 */
export const setupSelectionTracking = (editor: HTMLElement, onSelectionChange: (state: SelectionState) => void) => {
  const handleSelectionChange = debounce(150, () => {
    if (!editor) return

    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return

    const range = selection.getRangeAt(0)

    // Проверяем, находится ли выделение в редакторе
    if (!editor.contains(range.commonAncestorContainer)) return

    // Рассчитываем позицию выделения
    const rangeRect = range.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect()

    const position = {
      top: rangeRect.top - editorRect.top + editor.scrollTop,
      left: rangeRect.left - editorRect.left + editor.scrollLeft
    }

    const state: SelectionState = {
      range,
      text: selection.toString(),
      isEmpty: selection.isCollapsed,
      position
    }

    onSelectionChange(state)
  })

  // Устанавливаем обработчики событий
  document.addEventListener('selectionchange', handleSelectionChange)
  editor.addEventListener('click', handleSelectionChange)
  editor.addEventListener('input', handleSelectionChange)

  // Возвращаем функцию для отключения отслеживания
  return () => {
    document.removeEventListener('selectionchange', handleSelectionChange)
    if (editor) {
      editor.removeEventListener('click', handleSelectionChange)
      editor.removeEventListener('input', handleSelectionChange)
    }
  }
}

// Реэкспорт для обратной совместимости
export { getCursorPosition }
