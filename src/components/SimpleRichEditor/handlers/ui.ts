/**
 * @module handlers/ui
 * @description UI helper functions for SimpleRichEditor
 */

import { Accessor } from 'solid-js'
import { isEmptyContent } from '../lib/empty'
import { calculatePlusMenuLeft, calculatePlusMenuTop, getEditorPosition, isTouchDevice } from '../lib/positioning'
import { findLinkAncestor as findLinkAncestorUtil } from '../lib/selection'
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
  showIncutEditor: Accessor<boolean>
  hasSelection: Accessor<boolean>
  content: Accessor<string>
  cursorPosition: Accessor<{ top: number; left: number } | null>
}

/**
 * Creates UI helper functions for the editor
 */
export const createUIHelpers = (context: UIHelpersContext) => {
  const { editorRef, props, hasFocus, showForm, showIncutEditor, hasSelection, content } = context

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
    // Скрываем Plus-меню если есть: формы, incut-меню, или активное выделение (floating toolbar)
    const isNoOtherMenuOpen = !showForm() && !showIncutEditor() && !hasActiveSelection
    const isPlusEnabled = props.plus

    console.log('[PlusMenu Debug] shouldShowPlusMenu conditions:', {
      isNewLine,
      isEditorInFocus,
      isNoOtherMenuOpen,
      isPlusEnabled,
      showForm: showForm(),
      showIncutEditor: showIncutEditor(),
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

  // Используем утилиты для вычисления позиций Plus-меню (DRY)
  const getPlusMenuTop = (): number => calculatePlusMenuTop(editorRef())
  const getPlusMenuLeft = (): number => calculatePlusMenuLeft(editorRef())

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
    findLinkAncestor: (node: Node | null) => findLinkAncestorUtil(node, editorRef()),
    updatePlaceholderState
  }
}
