/**
 * @module handlers/ui
 * @description UI helper functions for SimpleRichEditor
 */

import { Accessor } from 'solid-js'
import { isEmptyContent } from '../lib/empty'
import { getEditorPosition, isTouchDevice } from '../lib/positioning'
import { Position, ToolbarMode } from '../lib/types'

export interface UIHelpersContext {
  editorRef: Accessor<HTMLDivElement | undefined>
  props: {
    toolbar?: ToolbarMode
    plus?: boolean
  }
  // State
  hasFocus: Accessor<boolean>
  showForm: Accessor<string | null>
  showSquibEditor: Accessor<boolean>
  content: Accessor<string>
  cursorPosition: Accessor<{ top: number; left: number } | null>
}

/**
 * Creates UI helper functions for the editor
 */
export const createUIHelpers = (context: UIHelpersContext) => {
  const { editorRef, props, hasFocus, showForm, showSquibEditor, content } = context

  const currentToolbarMode = (): ToolbarMode => props.toolbar || 'float'

  const isClickInsideToolbar = (e: FocusEvent): boolean => {
    if (!e.relatedTarget) return false
    const target = e.relatedTarget as HTMLElement
    return target.closest('.toolbar') !== null || target.closest('[data-toolbar="true"]') !== null
  }

  const isEditorEmpty = () => {
    const editor = editorRef()
    if (!editor) return true
    const currentSignalContent = content()
    if (isEmptyContent(currentSignalContent)) return true
    const contentHtml = editor.innerHTML.trim()
    if (contentHtml === '<p><br></p>' || contentHtml === '<p></p>') return true
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = contentHtml
    const textContent = tempDiv.textContent?.trim() || ''
    return textContent === ''
  }

  const isCursorOnEmptyLine = (): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) {
      console.log('[PlusMenu Debug] isCursorOnEmptyLine: no selection')
      return true
    }
    const range = selection.getRangeAt(0)
    const node = range.startContainer
    const editorNode = editorRef()
    if (!editorNode || !editorNode.contains(node)) {
      console.log('[PlusMenu Debug] isCursorOnEmptyLine: node not in editor')
      return false
    }
    const currentNode = node.nodeType === Node.TEXT_NODE ? node : (node as Element)
    const parentElement = node.nodeType === Node.TEXT_NODE ? node.parentElement : (currentNode as HTMLElement)

    if (node.nodeType === Node.TEXT_NODE) {
      const textBeforeCursor = node.textContent?.slice(0, range.startOffset) || ''
      return textBeforeCursor.trim() === ''
    }

    if (parentElement) {
      if (
        parentElement.innerHTML === '' ||
        parentElement.innerHTML === '<br>' ||
        parentElement.textContent?.trim() === '' ||
        ((node as Element).textContent?.trim() === '' && parentElement.innerHTML.includes('<img'))
      ) {
        return true
      }
      if (range.startOffset === 0 && parentElement.textContent?.trim()) {
        return true
      }
    }

    if (range.startOffset === 0 && (node === editorNode || parentElement === editorNode)) {
      console.log('[PlusMenu Debug] isCursorOnEmptyLine: cursor at start of editor - TRUE')
      return true
    }

    console.log('[PlusMenu Debug] isCursorOnEmptyLine: no conditions met - FALSE')
    return false
  }

  // видимость Plus-меню (boolean)
  const shouldShowPlusMenu = (): boolean => {
    const isNewLine = isCursorOnEmptyLine()
    const isEditorInFocus = hasFocus()
    const isNoOtherMenuOpen = !showForm() && !showSquibEditor()
    const isPlusEnabled = props.plus

    console.log('[PlusMenu Debug] shouldShowPlusMenu conditions:', {
      isNewLine,
      isEditorInFocus,
      isNoOtherMenuOpen,
      isPlusEnabled,
      showForm: showForm(),
      showSquibEditor: showSquibEditor(),
      result: isEditorInFocus && isNewLine && isPlusEnabled && isNoOtherMenuOpen
    })

    return !!(isEditorInFocus && isNewLine && isPlusEnabled && isNoOtherMenuOpen)
  }

  const getFloatingToolbarPosition = (): Position => {
    return getEditorPosition(editorRef() || null, {
      type: 'float',
      placement: 'top',
      offset: 60, // Увеличиваем отступ для лучшего позиционирования
      centerHorizontally: isTouchDevice()
    })
  }

  // top позиция Plus-меню (number)
  const getPlusMenuTop = (): number => {
    const editor = editorRef()
    if (!editor) return 0

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      const editorRect = editor.getBoundingClientRect()
      return editorRect.top + 10 // Fallback: первая строка
    }

    const range = selection.getRangeAt(0)

    // Находим все элементы-строки в редакторе (div, p)
    const lines = Array.from(editor.querySelectorAll('div, p'))

    // Определяем в какой строке находится курсор
    const container = range.startContainer
    let currentLine: Element | null = null
    let lineIndex = 0

    // Ищем родительский элемент-строку
    let node: Node | null = container
    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        if (element.tagName === 'DIV' || element.tagName === 'P') {
          currentLine = element
          break
        }
      }
      node = node.parentNode
    }

    if (currentLine) {
      lineIndex = lines.indexOf(currentLine)
      console.log('[getPlusMenuTop] Line index:', lineIndex, 'of', lines.length)
    }

    // Вычисляем top позицию (+1 строчка ниже курсора)
    const editorRect = editor.getBoundingClientRect()
    const lineHeight = 24 // Примерная высота строки в пикселях
    const editorPaddingTop = Number.parseInt(getComputedStyle(editor).paddingTop, 10) || 0

    // Добавляем +1 к lineIndex, чтобы плюс был на строчку ниже
    const topPosition = editorRect.top + editorPaddingTop + (lineIndex + 1) * lineHeight + lineHeight / 2 - 16

    console.log('[getPlusMenuTop] Calculated (+1 line below):', {
      lineIndex: lineIndex + 1,
      editorTop: editorRect.top,
      paddingTop: editorPaddingTop,
      lineHeight,
      calculatedTop: topPosition
    })

    return topPosition
  }

  // Фиксированная left позиция Plus-меню (number)
  const getPlusMenuLeft = (): number => {
    const editor = editorRef()
    if (!editor) return 0

    const editorRect = editor.getBoundingClientRect()
    return editorRect.left - 45
  }

  const findLinkAncestor = (node: Node | null): HTMLAnchorElement | null => {
    if (!node) return null
    let currentNode = node
    const rootNode = editorRef()
    while (currentNode && currentNode !== rootNode) {
      if (currentNode.nodeName === 'A') {
        return currentNode as HTMLAnchorElement
      }
      if (!currentNode.parentNode || currentNode.parentNode === document.body) break
      currentNode = currentNode.parentNode
    }
    return null
  }

  const updatePlaceholderState = () => {
    const isEmpty = isEditorEmpty()
    const editorElement = editorRef()
    if (editorElement) {
      if (isEmpty) {
        editorElement.classList.add('empty', 'placeholder-visible')
      } else {
        editorElement.classList.remove('empty', 'placeholder-visible')
      }
    }
  }

  return {
    currentToolbarMode,
    isClickInsideToolbar,
    isEditorEmpty,
    isCursorOnEmptyLine,
    shouldShowPlusMenu,
    getFloatingToolbarPosition,
    getPlusMenuTop,
    getPlusMenuLeft,
    findLinkAncestor,
    updatePlaceholderState
  }
}
