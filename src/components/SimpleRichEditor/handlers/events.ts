/**
 * @module handlers/events
 * @description Event handlers for SimpleRichEditor
 */

import { Accessor } from 'solid-js'
import { debounce } from 'throttle-debounce'
import { isEmptyContent } from '../lib/empty'
import { cleanupJsonContent } from '../lib/storage'
import { EditorData, EditorFieldType } from '../lib/types'
import { replaceSelection } from '../lib/utils'
import { handleContentPaste } from '../media'

export interface EventHandlersContext {
  editorRef: Accessor<HTMLDivElement | undefined>
  props: {
    readOnly?: boolean
    fieldType?: EditorFieldType
    onChange: (data: EditorData) => void
    onFocus?: () => void
    onBlur?: () => void
  }
  // State setters
  setContent: (content: string) => void
  setHasFocus: (focus: boolean) => void
  // Utility functions
  isEditorEmpty: () => boolean
  updatePlaceholderState: () => void
  saveSelection: () => void
  restoreSelection: () => boolean
  selectionInfo: Accessor<{ text: string; isEmpty: boolean }>
  cursorPosition: Accessor<{ top: number; left: number } | null>
  handleDropFilesHook: (e: DragEvent) => Promise<void>
  // Modal functions
  // biome-ignore lint/suspicious/noExplicitAny: Modal callbacks can have various types
  showModal?: (modalType: any, source?: any, callbacks?: any) => void
  hideModal?: () => void
}

/**
 * Creates event handlers for the editor
 */
export const createEventHandlers = (context: EventHandlersContext) => {
  const {
    editorRef,
    props,
    setContent,
    setHasFocus,
    isEditorEmpty,
    updatePlaceholderState,
    saveSelection,
    restoreSelection,
    selectionInfo,
    cursorPosition,
    handleDropFilesHook
  } = context

  /**
   * Получает HTML содержимое из редактора
   */
  const getHTML = (editor: HTMLElement): string => {
    const rawContent = editor.innerHTML || ''
    const contentHtml = cleanupJsonContent(rawContent)
    setContent(contentHtml)
    return contentHtml
  }

  /**
   * Основной обработчик изменений
   */
  const handleChange = (_fieldName?: string) => {
    const editor = editorRef()
    if (!editor) return

    updatePlaceholderState()

    const contentHtml = getHTML(editor)
    const editorIsEmpty = isEditorEmpty()

    // Обновляем UI состояние если редактор пуст
    if (editorIsEmpty) {
      editor.classList.add('show-placeholder-on-new-line')
    } else {
      editor.classList.remove('show-placeholder-on-new-line')
    }

    const plainText = editor.innerText || ''
    const currentSelectionInfo = selectionInfo()

    const editorData: EditorData = {
      content: contentHtml,
      plainText: plainText,
      length: plainText.length,
      isEmpty: editorIsEmpty,
      selection: {
        text: currentSelectionInfo.text,
        isEmpty: currentSelectionInfo.isEmpty,
        position: cursorPosition() || undefined
      }
    }

    props.onChange(editorData)
  }

  // Debounced version for input events
  const debouncedHandleChange = debounce(150, () => handleChange(props.fieldType ? String(props.fieldType) : 'content'))

  const handleInput = (_e: InputEvent) => {
    debouncedHandleChange()
  }

  const handleFocus = () => {
    setHasFocus(true)

    const editor = editorRef()
    if (editor) {
      const editorIsEmpty = isEmptyContent(editor.innerHTML)
      updatePlaceholderState()

      // Обновляем класс для показа placeholder на новой строке
      if (!editorIsEmpty) {
        editor.classList.add('show-placeholder-on-new-line')
      } else {
        editor.classList.remove('show-placeholder-on-new-line')
      }
    }

    if (props.onFocus) props.onFocus()
  }

  const handleBlur = (e: FocusEvent) => {
    // Проверяем, что клик не был внутри тулбара
    if (isClickInsideToolbar(e)) return

    setHasFocus(false)

    const editor = editorRef()
    if (editor?.contains(e.relatedTarget as Node)) return

    if (editor) {
      updatePlaceholderState()
      editor.classList.remove('show-placeholder-on-new-line')
    }

    if (props.onBlur) props.onBlur()
  }

  const handlePaste = async (e: ClipboardEvent) => {
    e.preventDefault()
    const html = e.clipboardData?.getData('text/html')
    const text = e.clipboardData?.getData('text')
    if (!text && !html) return

    saveSelection()
    let pasted = false

    // Проверяем text на URL embed платформы ПЕРЕД обработкой HTML
    if (text && !html) {
      const trimmedText = text.trim()
      // Проверяем - это одиночный URL?
      const urlRegex = /^https?:\/\/[^\s]+$/
      if (urlRegex.test(trimmedText)) {
        const { detectEmbedPlatform } = await import('../media')
        const platform = detectEmbedPlatform(trimmedText)

        if (platform !== 'unknown' && context.showModal && context.hideModal) {
          // Это embed платформа - показываем диалог выбора
          const _savedSelection = saveSelection()

          context.showModal('embedChoice', undefined, {
            data: { url: trimmedText, platform },
            onSuccess: async (type: 'link' | 'embed') => {
              context.hideModal?.()
              restoreSelection()

              if (type === 'embed') {
                // Вставляем как <embed>
                const { createUniversalEmbed } = await import('../media/html')
                const embedHtml = await createUniversalEmbed(trimmedText, platform)

                if (embedHtml) {
                  replaceSelection(embedHtml, editorRef() || null)
                  handleChange(props.fieldType ? String(props.fieldType) : 'content')
                }
              } else {
                // Вставляем как обычную ссылку <a>
                const linkHtml = `<a href="${trimmedText}" target="_blank" rel="noopener noreferrer">${trimmedText}</a>`
                replaceSelection(linkHtml, editorRef() || null)
                handleChange(props.fieldType ? String(props.fieldType) : 'content')
              }

              editorRef()?.focus()
            },
            onCancel: () => {
              context.hideModal?.()
              restoreSelection()
              // Вставляем как обычный текст
              const selection = window.getSelection()
              if (selection?.rangeCount) {
                const range = selection.getRangeAt(0)
                const textNode = document.createTextNode(trimmedText)
                range.deleteContents()
                range.insertNode(textNode)
                range.setStartAfter(textNode)
                range.collapse(true)
                selection.removeAllRanges()
                selection.addRange(range)
              }
              handleChange(props.fieldType ? String(props.fieldType) : 'content')
              editorRef()?.focus()
            }
          })

          return // Не обрабатываем дальше
        }
      }
    }

    if (html) {
      console.log('Pasting HTML')
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = html

      // Нормализация тегов
      tempDiv.querySelectorAll('i').forEach((tag) => {
        const em = document.createElement('em')
        while (tag.firstChild) em.appendChild(tag.firstChild)
        Array.from(tag.attributes).forEach((attr) => {
          em.setAttribute(attr.name, attr.value)
        })
        tag.parentNode?.replaceChild(em, tag)
      })

      tempDiv.querySelectorAll('b').forEach((tag) => {
        const strong = document.createElement('strong')
        while (tag.firstChild) strong.appendChild(tag.firstChild)
        Array.from(tag.attributes).forEach((attr) => {
          strong.setAttribute(attr.name, attr.value)
        })
        tag.parentNode?.replaceChild(strong, tag)
      })

      // Удаляем пустые теги
      tempDiv.querySelectorAll('em:empty, strong:empty, i:empty, b:empty, span:empty').forEach((tag) => {
        if (!tag.textContent || tag.textContent === '\u200B') tag.remove()
      })

      const cleanHtml = tempDiv.innerHTML
      if (restoreSelection()) {
        pasted = replaceSelection(cleanHtml, editorRef() || null)
      }
    }

    if (!pasted && text) {
      console.log('Pasting TEXT')
      if (restoreSelection()) {
        await handleContentPaste(text, {
          insertText: async (textToInsert) => {
            const selection = window.getSelection()
            if (!selection || !selection.rangeCount) return false
            const range = selection.getRangeAt(0)
            const textNode = document.createTextNode(textToInsert)
            range.deleteContents()
            range.insertNode(textNode)
            range.setStartAfter(textNode)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)
            return true
          },
          insertHtml: async (htmlToInsert) => {
            return replaceSelection(htmlToInsert, editorRef() || null)
          }
        })
        pasted = true
      }
    }

    if (pasted) {
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
    }
  }

  const handleDropFiles = async (e: DragEvent) => {
    e.preventDefault()
    if (!editorRef() || props.readOnly) return

    await handleDropFilesHook(e)
    handleChange(props.fieldType ? String(props.fieldType) : 'content')
    editorRef()?.focus()
  }

  // Helper function
  const isClickInsideToolbar = (e: FocusEvent): boolean => {
    if (!e.relatedTarget) return false
    const target = e.relatedTarget as HTMLElement
    return target.closest('.toolbar') !== null || target.closest('[data-toolbar="true"]') !== null
  }

  return {
    handleInput,
    handleFocus,
    handleBlur,
    handlePaste,
    handleDropFiles,
    handleChange,
    debouncedHandleChange
  }
}
