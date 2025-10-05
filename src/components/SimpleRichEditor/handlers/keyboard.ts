/**
 * @module handlers/keyboard
 * @description Keyboard event handlers for SimpleRichEditor
 */

import { Accessor } from 'solid-js'
import { applyFormatting } from '../format/format'
import { CommandType, EditorFieldType } from '../lib/types'
import { replaceSelection } from '../lib/utils'

export interface KeyboardHandlersContext {
  editorRef: Accessor<HTMLDivElement | undefined>
  props: {
    fieldType?: EditorFieldType
    editorId?: string
  }
  // Functions
  trackSelectionAndCursor: () => void
  handleAction: (command: CommandType) => void
  handleChange: (fieldName?: string) => void
  restoreSelection: () => boolean
  // Navigation
  handleNavigation: (nextField: EditorFieldType) => boolean
}

/**
 * Creates keyboard event handlers for the editor
 */
export const createKeyboardHandlers = (context: KeyboardHandlersContext) => {
  const { editorRef, props, trackSelectionAndCursor, handleAction, handleChange, restoreSelection, handleNavigation } =
    context

  const handleKeyDown = (e: KeyboardEvent) => {
    const isMac = navigator.platform.includes('Mac')
    const cmdKey = isMac ? e.metaKey : e.ctrlKey

    // Arrow keys - just track selection
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      setTimeout(trackSelectionAndCursor, 0)
      return
    }

    // Formatting shortcuts
    if (cmdKey && !e.shiftKey && !e.altKey) {
      const shortcuts: { [key: string]: CommandType } = {
        b: 'bold',
        i: 'italic',
        k: 'link',
        '1': 'h1',
        '2': 'h2',
        '3': 'h3',
        q: 'blockquote'
      }
      if (shortcuts[e.key]) {
        e.preventDefault()
        handleAction(shortcuts[e.key])
        return
      }
    }

    // Draft navigation with Tab
    if (e.key === 'Tab' && props.fieldType && props.editorId?.startsWith('draft-')) {
      e.preventDefault()
      const currentField = props.fieldType
      let prevField: EditorFieldType | null = null
      let nextField: EditorFieldType | null = null

      if (currentField === 'title') {
        nextField = 'lead'
      } else if (currentField === 'lead') {
        prevField = 'title'
        nextField = 'body'
      } else if (currentField === 'body') {
        prevField = 'lead'
      }

      if (e.shiftKey && prevField) handleNavigation(prevField)
      else if (!e.shiftKey && nextField) handleNavigation(nextField)
      return
    }

    // Shift+Enter для выхода из блочных элементов или вставки <br>
    if (e.shiftKey && e.key === 'Enter') {
      // В lead всегда вставляем <br>
      if (props.fieldType === 'lead') {
        e.preventDefault()
        if (restoreSelection()) {
          replaceSelection('<br>', editorRef() || null)
          handleChange(props.fieldType ? String(props.fieldType) : 'content')
        }
        return
      }

      // В body проверяем - находимся ли внутри блочного элемента
      if (props.fieldType === 'body') {
        const selection = window.getSelection()
        if (!selection || !selection.rangeCount) {
          setTimeout(handleChange, 0)
          return
        }

        const range = selection.getRangeAt(0)
        const container = range.startContainer
        const editorRoot = editorRef()
        if (!editorRoot) {
          setTimeout(handleChange, 0)
          return
        }

        // Проверяем - курсор внутри блочного элемента?
        const blockElement = (
          container.nodeType === Node.TEXT_NODE
            ? container.parentElement
            : container instanceof Element
              ? container
              : null
        )?.closest('blockquote, h1, h2, h3, h4, h5, h6, ul, ol, div[data-type], div[data-align]')

        if (blockElement && editorRoot.contains(blockElement)) {
          // Shift+Enter внутри блока - создаем новый параграф после блока
          e.preventDefault()

          const newParagraph = document.createElement('p')
          newParagraph.innerHTML = '<br>'

          // Вставляем новый параграф после текущего блока
          if (blockElement.parentNode) {
            if (blockElement.nextSibling) {
              blockElement.parentNode.insertBefore(newParagraph, blockElement.nextSibling)
            } else {
              blockElement.parentNode.appendChild(newParagraph)
            }
          }

          // Перемещаем курсор в новый параграф
          const newRange = document.createRange()
          newRange.setStart(newParagraph, 0)
          newRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(newRange)

          handleChange(props.fieldType ? String(props.fieldType) : 'content')
          console.log('[Shift+Enter] Exited block element, created new paragraph')
          return
        }
      }

      // В остальных случаях - стандартное поведение
      setTimeout(handleChange, 0)
      return
    }

    // Enter key handling
    if (e.key === 'Enter') {
      // Navigate on Cmd/Ctrl+Enter in lead
      if (props.fieldType === 'lead' && cmdKey) {
        e.preventDefault()
        handleNavigation('body')
        return
      }

      // Insert <br> on Enter in lead
      if (props.fieldType === 'lead') {
        e.preventDefault()
        if (restoreSelection()) {
          replaceSelection('<br>', editorRef() || null)
          handleChange(props.fieldType ? String(props.fieldType) : 'content')
        }
        return
      }

      // Body field: Handle block element behavior
      if (props.fieldType === 'body') {
        const selection = window.getSelection()
        if (!selection || !selection.rangeCount) return

        const range = selection.getRangeAt(0)
        const container = range.startContainer
        const editorRoot = editorRef()
        if (!editorRoot) return

        const blockElement = (
          container.nodeType === Node.TEXT_NODE
            ? container.parentElement
            : container instanceof Element
              ? container
              : null
        )?.closest('blockquote, h1, h2, h3, ul, ol, div[data-type], div[data-align]')

        if (blockElement && editorRoot.contains(blockElement)) {
          const isEmptyBlock =
            blockElement.textContent?.trim() === '' ||
            blockElement.innerHTML === '<br>' ||
            blockElement.innerHTML === ''

          // Enter в пустом блоке → выход из блока
          if (isEmptyBlock) {
            e.preventDefault()
            // Exit block: Create new paragraph after
            const p = document.createElement('p')
            p.innerHTML = '<br>'

            if (blockElement.parentNode) {
              if (blockElement.nextSibling) {
                blockElement.parentNode.insertBefore(p, blockElement.nextSibling)
              } else {
                blockElement.parentNode.appendChild(p)
              }
            } else {
              console.warn('[handleKeyDown] Cannot safely insert element')
              return
            }

            // Remove empty block
            blockElement.remove()

            // Move cursor to new paragraph
            range.setStart(p, 0)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)
            handleChange(props.fieldType ? String(props.fieldType) : 'content')
            console.log('[Enter] Exited empty block element')
            return
          }

          // Enter в непустом блоке → стандартное поведение (добавление внутри блока)
          setTimeout(handleChange, 0)
          return
        }

        // Default Enter behavior
        setTimeout(handleChange, 0)
        return
      }
    }

    // Backspace/Delete key handling for block elements
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount || !editorRef() || !selection.isCollapsed) {
        setTimeout(handleChange, 0)
        return
      }

      const range = selection.getRangeAt(0)
      const editor = editorRef()!
      const container = range.startContainer

      // Check if cursor is at the start of a block element for Backspace
      if (e.key === 'Backspace' && range.startOffset === 0) {
        const blockElement = (
          container.nodeType === Node.TEXT_NODE
            ? container.parentElement
            : container instanceof Element
              ? container
              : null
        )?.closest('blockquote, h1, h2, h3, ul, ol, div[data-type], div[data-align]')

        if (blockElement && editor.contains(blockElement)) {
          let isAtVeryStart = false
          if (
            container === blockElement ||
            (container.nodeType === Node.TEXT_NODE && container.parentElement === blockElement)
          ) {
            isAtVeryStart = true
          } else {
            // Check if there's any content before the cursor within the block
            const tempRange = document.createRange()
            tempRange.setStart(blockElement, 0)
            tempRange.setEnd(range.startContainer, range.startOffset)
            if (tempRange.toString().trim() === '') {
              isAtVeryStart = true
            }
          }

          if (isAtVeryStart) {
            e.preventDefault()

            // Специальная обработка для списков - только если единственный элемент
            const tagName = blockElement.tagName.toLowerCase()
            if (tagName === 'ul' || tagName === 'ol') {
              // Находим элемент li внутри списка
              const listItem =
                container.nodeType === Node.TEXT_NODE
                  ? container.parentElement?.closest('li')
                  : (container as HTMLElement).closest('li')

              if (listItem && blockElement.contains(listItem) && blockElement.children.length === 1) {
                // Только если это единственный элемент в списке - убираем форматирование списка
                console.log('[Backspace] Removing list formatting (single item)')

                const p = document.createElement('p')
                while (listItem.firstChild) {
                  p.appendChild(listItem.firstChild)
                }

                blockElement.parentNode?.replaceChild(p, blockElement)

                // Восстанавливаем курсор
                const newRange = document.createRange()
                newRange.setStart(p, 0)
                newRange.collapse(true)
                const sel = window.getSelection()
                sel?.removeAllRanges()
                sel?.addRange(newRange)

                handleChange(props.fieldType ? String(props.fieldType) : 'content')
                return
              }
              // Если элементов больше одного - пропускаем, обработается стандартно
            }

            // Преобразуем любой блок (включая squib с data-align) в параграф одним действием
            console.log('[Backspace] Converting block to paragraph')
            const currentSelection = window.getSelection()
            const currentRange = currentSelection?.rangeCount ? currentSelection.getRangeAt(0) : null
            applyFormatting('p', {
              range: currentRange,
              text: currentSelection?.toString() || '',
              isEmpty: !currentSelection || currentSelection.isCollapsed,
              position: { top: 0, left: 0 }
            })
            handleChange(props.fieldType ? String(props.fieldType) : 'content')
            return
          }
        }
      }

      // Let default Backspace/Delete handle other cases
      setTimeout(handleChange, 0)
      return
    }

    // For other keys, let default behavior occur
    // handleInput will handle the content updates for typing
  }

  return {
    handleKeyDown
  }
}
