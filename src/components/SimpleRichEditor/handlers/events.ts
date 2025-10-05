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

  const handleInput = async (e: InputEvent) => {
    debouncedHandleChange()

    // Проверяем, ввел ли пользователь URL (закончил пробелом/Enter)
    if (e.inputType === 'insertText' && (e.data === ' ' || e.data === '\n')) {
      const editor = editorRef()
      if (!editor) return

      const selection = window.getSelection()
      if (!selection?.rangeCount) return

      const range = selection.getRangeAt(0)
      const node = range.startContainer

      // Получаем текст до курсора
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const textBeforeCursor = node.textContent.substring(0, range.startOffset)
        // Извлекаем последнее слово (потенциальный URL)
        const words = textBeforeCursor.split(/\s+/)
        const lastWord = words[words.length - 1]

        // Проверяем - это URL?
        const urlRegex = /^https?:\/\/[^\s]+$/
        if (urlRegex.test(lastWord)) {
          const { detectEmbedPlatform } = await import('../media')
          const platform = detectEmbedPlatform(lastWord)

          if (platform !== 'unknown') {
            // Сохраняем позицию для замены
            const urlStart = textBeforeCursor.lastIndexOf(lastWord)
            const urlEnd = range.startOffset

            // Удаляем введенный URL
            if (node.textContent) {
              const beforeUrl = node.textContent.substring(0, urlStart)
              const afterUrl = node.textContent.substring(urlEnd)
              node.textContent = beforeUrl + afterUrl

              // Восстанавливаем курсор
              const newRange = document.createRange()
              newRange.setStart(node, urlStart)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)
            }

            // Вставляем inline choice компонент
            const { EmbedInlineChoice } = await import('../components/EmbedInlineChoice')
            const { render } = await import('solid-js/web')

            const choiceContainer = document.createElement('div')
            choiceContainer.contentEditable = 'false'
            choiceContainer.style.userSelect = 'none'

            const handleChoice = async (type: 'link' | 'embed') => {
              if (type === 'embed') {
                const { createUniversalEmbed } = await import('../media/html')
                const embedHtml = await createUniversalEmbed(lastWord, platform)
                if (embedHtml) {
                  const tempDiv = document.createElement('div')
                  tempDiv.innerHTML = embedHtml
                  choiceContainer.replaceWith(...Array.from(tempDiv.childNodes))
                }
              } else {
                const link = document.createElement('a')
                link.href = lastWord
                link.target = '_blank'
                link.rel = 'noopener noreferrer'
                link.textContent = lastWord
                choiceContainer.replaceWith(link)
              }
              handleChange(props.fieldType ? String(props.fieldType) : 'content')
              editor.focus()
            }

            const handleCancel = () => {
              const textNode = document.createTextNode(lastWord)
              choiceContainer.replaceWith(textNode)
              editor.focus()
            }

            render(
              () =>
                EmbedInlineChoice({
                  url: lastWord,
                  platform,
                  onChoice: handleChoice,
                  onCancel: handleCancel
                }),
              choiceContainer
            )

            // Вставляем контейнер
            replaceSelection(choiceContainer.outerHTML, editor)
          }
        }
      }
    }
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

        if (platform !== 'unknown') {
          // Это embed платформа - вставляем inline choice компонент
          e.preventDefault()

          const { EmbedInlineChoice } = await import('../components/EmbedInlineChoice')
          const { render } = await import('solid-js/web')

          // Создаем временный контейнер для inline choice
          const choiceContainer = document.createElement('div')
          choiceContainer.contentEditable = 'false'
          choiceContainer.style.userSelect = 'none'

          const handleChoice = async (type: 'link' | 'embed') => {
            if (type === 'embed') {
              const { createUniversalEmbed } = await import('../media/html')
              const embedHtml = await createUniversalEmbed(trimmedText, platform)
              if (embedHtml) {
                const tempDiv = document.createElement('div')
                tempDiv.innerHTML = embedHtml
                choiceContainer.replaceWith(...Array.from(tempDiv.childNodes))
              }
            } else {
              const link = document.createElement('a')
              link.href = trimmedText
              link.target = '_blank'
              link.rel = 'noopener noreferrer'
              link.textContent = trimmedText
              choiceContainer.replaceWith(link)
            }
            handleChange(props.fieldType ? String(props.fieldType) : 'content')
            editorRef()?.focus()
          }

          const handleCancel = () => {
            const textNode = document.createTextNode(trimmedText)
            choiceContainer.replaceWith(textNode)
            editorRef()?.focus()
          }

          // Рендерим компонент
          render(
            () =>
              EmbedInlineChoice({
                url: trimmedText,
                platform,
                onChoice: handleChoice,
                onCancel: handleCancel
              }),
            choiceContainer
          )

          // Вставляем контейнер в позицию курсора
          const selection = window.getSelection()
          if (selection?.rangeCount) {
            const range = selection.getRangeAt(0)
            range.deleteContents()
            range.insertNode(choiceContainer)
            range.setStartAfter(choiceContainer)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)
          }

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
