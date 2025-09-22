import { Accessor, createEffect, createSignal } from 'solid-js'
import { isServer } from 'solid-js/web'
import { debounce } from 'throttle-debounce'
import { hasFormatting } from '../format/format'
import { MENU_GROUPS } from '../menu/config'
import { isEmptyContent } from './empty'
import { CommandGroupType, CommandType, Position, SelectionState } from './types'
import { trackSelectionAndCursor } from './utils'

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

// getCursorPosition перенесен в utils.ts для избежания дублирования
export { getCursorPosition } from './utils'

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

  const updateActiveFormats = () => {
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
      // Создаем пустой Set для форматов
      const computedFormats = new Set<CommandType>()

      // Проверяем, что MENU_GROUPS существует
      if (!MENU_GROUPS) {
        console.warn('[SimpleRichEditor] MENU_GROUPS is undefined')
        return activeFormats()
      }

      // Итерируем по ключам MENU_GROUPS, приводя их к CommandGroupType
      Object.keys(MENU_GROUPS).forEach((groupKey: string) => {
        if (!MENU_GROUPS[groupKey as CommandGroupType]) return

        const commandsInGroup: readonly CommandType[] = MENU_GROUPS[groupKey as CommandGroupType]
        if (!Array.isArray(commandsInGroup)) return

        commandsInGroup.forEach((cmd: CommandType) => {
          if (!cmd) return

          // Construct the SelectionState object explicitly matching the type
          const currentState: SelectionState = {
            range: range, // Range object
            text: selection.toString(), // Selected text
            isEmpty: selection.isCollapsed, // Is the selection collapsed?
            position: {
              // Position object
              top: rect.top,
              left: rect.left + rect.width / 2
            }
          }

          if (hasFormatting(cmd, currentState)) {
            computedFormats.add(cmd)
          }
        })
      })

      // Сравниваем рассчитанный Set с текущим значением сигнала
      const currentFormatsValue = activeFormats()
      if (
        computedFormats.size !== currentFormatsValue.size ||
        ![...computedFormats].every((format) => currentFormatsValue.has(format))
      ) {
        // Если есть разница, обновляем сигнал с помощью сеттера
        setActiveFormats(computedFormats)
      }

      // Возвращаем аксессор сигнала, чтобы внешний код получил ожидаемый тип
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
      // Предотвращаем падение редактора из-за ошибок отслеживания выделения
    }
  }

  // ОТКЛЮЧЕНО: MutationObserver создает конфликт с единым обработчиком в SimpleRichEditor
  // createEffect(() => {
  //   const editor = editorRef()
  //   if (editor) {
  //     const observer = new MutationObserver((_mutations) => {
  //       try {
  //         handleTrackSelectionAndCursor()
  //       } catch (error) {
  //         console.error('[SimpleRichEditor] Error handling mutation:', error)
  //       }
  //     })
  //     observer.observe(editor, {
  //       childList: true,
  //       subtree: true,
  //       characterData: true,
  //       attributes: false
  //     })
  //     onCleanup(() => observer.disconnect())
  //   }
  // })

  createEffect(() => {
    const currentToolbarMode = toolbarMode()
    const info = selectionInfo()

    if (currentToolbarMode === 'float') {
      setToolbarSignal(info.text && !info.isEmpty ? 'float' : 'hidden')
    } else {
      // В других режимах (top/bottom/hidden) сигнал toolbarSignal не используется для управления видимостью,
      // видимость определяется напрямую в JSX по toolbarMode()
      // Можно сбросить его в 'hidden' для консистентности, если нужно.
      // setToolbarSignal('hidden');
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

/**
 * Настраивает отслеживание выделения в редакторе
 *
 * @param editor DOM-элемент редактора
 * @param onSelectionChange Колбэк, вызываемый при изменении выделения
 * @returns Функции cleanup для отключения отслеживания
 */
export const setupSelectionTracking = (editor: HTMLElement, onSelectionChange: (state: SelectionState) => void) => {
  // Обработчик изменения выделения с дебаунсом
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
