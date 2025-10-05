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
  hasSelection: Accessor<boolean>
  content: Accessor<string>
  cursorPosition: Accessor<{ top: number; left: number } | null>
}

/**
 * Creates UI helper functions for the editor
 */
export const createUIHelpers = (context: UIHelpersContext) => {
  const { editorRef, props, hasFocus, showForm, showSquibEditor, hasSelection, content } = context

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

  // Проверяет, находится ли курсор на последней или предпоследней строке
  const isCursorNearEnd = (): boolean => {
    const editor = editorRef()
    if (!editor) return false

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const range = selection.getRangeAt(0)
    const lines = Array.from(editor.querySelectorAll('div, p, h1, h2, h3'))
    const totalLines = lines.length

    // Находим текущую строку
    let node: Node | null = range.startContainer
    let currentLine: Element | null = null

    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        if (['DIV', 'P', 'H1', 'H2', 'H3'].includes(element.tagName)) {
          currentLine = element
          break
        }
      }
      node = node.parentNode
    }

    if (!currentLine) return false

    const lineIndex = lines.indexOf(currentLine)
    return lineIndex >= totalLines - 2
  }

  // видимость Plus-меню (boolean)
  const shouldShowPlusMenu = (): boolean => {
    const isNewLine = isCursorOnEmptyLine()
    const isEditorInFocus = hasFocus()
    const hasActiveSelection = hasSelection()
    // Скрываем Plus-меню если есть: формы, squib-меню, или активное выделение (floating toolbar)
    const isNoOtherMenuOpen = !showForm() && !showSquibEditor() && !hasActiveSelection
    const isPlusEnabled = props.plus

    console.log('[PlusMenu Debug] shouldShowPlusMenu conditions:', {
      isNewLine,
      isEditorInFocus,
      isNoOtherMenuOpen,
      isPlusEnabled,
      showForm: showForm(),
      showSquibEditor: showSquibEditor(),
      hasActiveSelection,
      result: isEditorInFocus && isNewLine && isPlusEnabled && isNoOtherMenuOpen
    })

    return !!(isEditorInFocus && isNewLine && isPlusEnabled && isNoOtherMenuOpen)
  }

  // видимость плейсхолдера (boolean) - только на последних строках!
  const shouldShowPlaceholder = (): boolean => {
    const isPlusVisible = shouldShowPlusMenu()
    const isNearEnd = isCursorNearEnd()

    console.log('[Placeholder Debug] shouldShowPlaceholder:', {
      isPlusVisible,
      isNearEnd,
      result: isPlusVisible && isNearEnd
    })

    return isPlusVisible && isNearEnd
  }

  const getFloatingToolbarPosition = (): Position => {
    return getEditorPosition(editorRef() || null, {
      type: 'float',
      placement: 'top',
      offset: 80, // Увеличиваем отступ чтобы не перекрывать текст
      centerHorizontally: isTouchDevice()
    })
  }

  // top позиция Plus-меню (number) - всегда на строке ниже курсора
  const getPlusMenuTop = (): number => {
    const editor = editorRef()
    if (!editor) return 0

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      const editorRect = editor.getBoundingClientRect()
      return editorRect.top + 10
    }

    const range = selection.getRangeAt(0)

    // Находим родительский элемент-строку текущей позиции курсора
    const container = range.startContainer
    let currentLine: Element | null = null

    let node: Node | null = container
    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        if (
          element.tagName === 'DIV' ||
          element.tagName === 'P' ||
          element.tagName === 'H1' ||
          element.tagName === 'H2' ||
          element.tagName === 'H3'
        ) {
          currentLine = element
          break
        }
      }
      node = node.parentNode
    }

    if (!currentLine) {
      const editorRect = editor.getBoundingClientRect()
      return editorRect.top + 10
    }

    // Получаем координаты текущей строки и показываем плюс на следующей строке
    const lineRect = currentLine.getBoundingClientRect()
    const lineHeight = lineRect.height || 24

    // Плюс на строке ниже = верх текущей строки + высота строки + отступ для центрирования
    return lineRect.top + lineHeight + lineHeight / 2 - 16
  }

  // Фиксированная left позиция Plus-меню (number)
  const getPlusMenuLeft = (): number => {
    const editor = editorRef()
    if (!editor) return 0

    const editorRect = editor.getBoundingClientRect()
    return editorRect.left - 34
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
    isCursorNearEnd,
    shouldShowPlusMenu,
    shouldShowPlaceholder,
    getFloatingToolbarPosition,
    getPlusMenuTop,
    getPlusMenuLeft,
    findLinkAncestor,
    updatePlaceholderState
  }
}
