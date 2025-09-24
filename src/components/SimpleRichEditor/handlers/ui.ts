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

  const shouldShowPlusMenu = () => {
    const isNewLine = isCursorOnEmptyLine()
    const isEditorInFocus = hasFocus()
    const isNoOtherMenuOpen = !showForm() && !showSquibEditor()
    const isPlusEnabled = props.plus

    // Отладочная информация
    console.log('[PlusMenu Debug] shouldShowPlusMenu conditions:', {
      isNewLine,
      isEditorInFocus,
      isNoOtherMenuOpen,
      isPlusEnabled,
      showForm: showForm(),
      showSquibEditor: showSquibEditor(),
      result: isEditorInFocus && isNewLine && isPlusEnabled && isNoOtherMenuOpen
    })

    return isEditorInFocus && isNewLine && isPlusEnabled && isNoOtherMenuOpen
  }

  const getFloatingToolbarPosition = (): Position => {
    return getEditorPosition(editorRef() || null, {
      type: 'float',
      placement: 'top',
      offset: 60, // Увеличиваем отступ для лучшего позиционирования
      centerHorizontally: isTouchDevice()
    })
  }

  const getPlusMenuPosition = (): { top: number; left: number; isVisible?: boolean } => {
    const editor = editorRef()
    if (!editor) {
      return { top: 0, left: 0, isVisible: false }
    }

    const editorRect = editor.getBoundingClientRect()
    const selection = window.getSelection()

    // Используем прямое получение позиции курсора из selection
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const rangeRect = range.getBoundingClientRect()

      if (rangeRect.height > 0) {
        // ИСПРАВЛЕННАЯ логика: используем viewport координаты напрямую
        const position = {
          top: rangeRect.top + rangeRect.height / 2 - 16, // Центр строки в viewport
          left: editorRect.left - 45, // Слева от редактора в viewport
          isVisible: true
        }

        console.log('[getPlusMenuPosition] FIXED position calculation:', {
          rangeRect: { top: rangeRect.top, left: rangeRect.left, height: rangeRect.height },
          editorRect: { top: editorRect.top, left: editorRect.left },
          windowScroll: { x: window.scrollX, y: window.scrollY },
          calculated: position,
          'position type': 'fixed viewport coordinates'
        })

        return position
      }
    }

    // Fallback: позиция в начале редактора (viewport координаты)
    const fallbackPosition = {
      top: editorRect.top + 10,
      left: editorRect.left - 45,
      isVisible: true
    }

    console.log('[getPlusMenuPosition] Fallback position (viewport):', fallbackPosition)

    return fallbackPosition
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
    getPlusMenuPosition,
    findLinkAncestor,
    updatePlaceholderState
  }
}
