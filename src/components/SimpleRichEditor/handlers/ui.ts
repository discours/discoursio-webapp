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
    if (!selection || !selection.rangeCount) return true
    const range = selection.getRangeAt(0)
    const node = range.startContainer
    const editorNode = editorRef()
    if (!editorNode || !editorNode.contains(node)) return false
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
      return true
    }
    return false
  }

  const shouldShowPlusMenu = () => {
    const isNewLine = isCursorOnEmptyLine()
    const isEditorInFocus = hasFocus()
    const isNoOtherMenuOpen = !showForm() && !showSquibEditor()
    const isPlusEnabled = props.plus
    return isEditorInFocus && isNewLine && isPlusEnabled && isNoOtherMenuOpen
  }

  const getFloatingToolbarPosition = (): Position => {
    return getEditorPosition(editorRef() || null, {
      type: 'float',
      placement: 'top',
      offset: 40,
      centerHorizontally: isTouchDevice()
    })
  }

  const getPlusMenuPosition = (): { top: number; left: number; isVisible?: boolean } => {
    const editor = editorRef()
    const selection = window.getSelection()
    if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) {
      return { top: 0, left: 0, isVisible: false }
    }

    const range = selection.getRangeAt(0)
    const node = range.startContainer

    // Find the closest block element containing the cursor
    let blockElement = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as HTMLElement | null
    while (
      blockElement &&
      blockElement !== editor &&
      !['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(blockElement.nodeName)
    ) {
      blockElement = blockElement.parentElement
    }

    // Ensure the block element is empty and directly within the editor content area
    if (!blockElement || !editor.contains(blockElement) || blockElement.closest('.ProseMirror') !== editor) {
      // Check if the direct parent is the editor itself
      if (node.parentElement === editor && (editor.innerHTML === '' || editor.innerHTML === '<br>')) {
        blockElement = editor // Treat editor as the block if it is empty
      } else {
        return { top: 0, left: 0, isVisible: false }
      }
    }

    const rect = blockElement.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect()
    const scrollTop = window.scrollY
    const scrollLeft = window.scrollX
    const offsetLeft = 20

    return {
      top: rect.top + scrollTop + rect.height / 2 - 12, // Assuming button height is ~24px
      left: editorRect.left + scrollLeft - offsetLeft,
      isVisible: true
    }
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
