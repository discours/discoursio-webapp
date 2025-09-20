/**
 * @module handlers/forms
 * @description Form handlers for SimpleRichEditor
 */

import { Accessor, Setter } from 'solid-js'
import { MODALS, useUI } from '~/context/ui'
import { MediaItem } from '~/graphql/generated/graphql'
import { UploadedFile } from '~/types/upload'
import { validateVideoUrl, validateWebUrl } from '../../../lib/validateDraft'
import { applyFormatting, removeFormatting } from '../format/format'
import { EditorFieldType, FormType, InlineFormOptions, Position } from '../lib/types'
import { replaceSelection, validateUrl } from '../lib/utils'
import { createVideoEmbed, detectVideoPlatform, handleAudioUploaderResult } from '../media'

export interface FormHandlersContext {
  editorRef: Accessor<HTMLDivElement | undefined>
  props: {
    fieldType?: EditorFieldType
    editorId?: string
  }
  // State
  showForm: Accessor<FormType>
  setShowForm: Setter<FormType>
  formPosition: Accessor<Position | null>
  setFormPosition: Setter<Position | null>
  formInitialValue: Accessor<string>
  setFormInitialValue: Setter<string>
  editingImage: Accessor<HTMLElement | null>
  setEditingImage: Setter<HTMLElement | null>
  // Utility functions
  saveSelection: () => void
  restoreSelection: () => boolean
  cursorPosition: Accessor<{ top: number; left: number } | null>
  handleChange: (fieldName?: string) => void
}

// Для хранения опций форм между вызовами
let editorFormOptions: InlineFormOptions | null = null

/**
 * Creates form handlers for the editor
 */
export const createFormHandlers = (context: FormHandlersContext) => {
  const { showModal, hideModal } = useUI()

  const {
    editorRef,
    props,
    setShowForm,
    setFormPosition,
    setFormInitialValue,
    editingImage,
    setEditingImage,
    saveSelection,
    restoreSelection,
    cursorPosition,
    handleChange
  } = context

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

  const showInlineForm = (type: FormType, onSubmit: (value: string) => void, initialValue?: string) => {
    if (!type) return

    // Получаем текущую позицию курсора для точного позиционирования формы
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      setFormPosition({
        top: rect.bottom + window.scrollY + 5,
        left: rect.left + window.scrollX
      })
    } else {
      // Запасной вариант
      const cursorPos = cursorPosition()
      if (cursorPos) {
        setFormPosition({
          top: cursorPos.top + window.scrollY + 5,
          left: cursorPos.left + window.scrollX
        })
      } else {
        // Используем центр редактора
        const editorRect = editorRef()?.getBoundingClientRect()
        if (editorRect) {
          setFormPosition({
            top: editorRect.top + window.scrollY + editorRect.height / 2,
            left: editorRect.left + window.scrollX + editorRect.width / 2
          })
        }
      }
    }

    // Устанавливаем начальное значение
    if (initialValue !== undefined) {
      setFormInitialValue(initialValue)
    } else {
      const currentLink = findLinkAncestor(window.getSelection()?.focusNode ?? null)
      const linkUrl = currentLink?.getAttribute('href') || ''
      setFormInitialValue(linkUrl)
    }

    setShowForm(type)

    // Устанавливаем опции формы
    editorFormOptions = {
      onSubmit,
      validate: type === 'video' ? (url: string) => validateVideoUrl(url) : (url: string) => validateWebUrl(url)
    }
  }

  const handleInlineFormSubmit = (type: FormType, url: string) => {
    setShowForm(null)
    if (restoreSelection()) {
      if (type === 'link') {
        const currentSelection = window.getSelection()
        const currentRange = currentSelection?.rangeCount ? currentSelection.getRangeAt(0) : null

        if (url === '') {
          // Удаляем ссылку
          removeFormatting('link', {
            range: currentRange,
            text: currentSelection?.toString() || '',
            isEmpty: !currentSelection || currentSelection.isCollapsed,
            position: { top: 0, left: 0 }
          })
        } else if (validateUrl(url)) {
          const caption = currentSelection?.toString() || ''
          applyFormatting('link', {
            range: currentRange,
            text: `<a href="${url}">${caption}</a>`,
            isEmpty: !currentSelection || currentSelection.isCollapsed,
            position: { top: 0, left: 0 }
          })
        } else {
          console.warn('Invalid URL for link:', url)
        }
      } else if (type === 'video' && validateVideoUrl(url)) {
        const platform = detectVideoPlatform(url)
        if (platform) {
          const embedHtml = createVideoEmbed(url)
          const editor = editorRef()
          if (editor && embedHtml) {
            replaceSelection(embedHtml, editor)
          }
        }
      } else {
        console.warn(`Invalid URL for ${type}:`, url)
      }
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
      editorRef()?.focus()
    } else {
      console.warn('Could not restore selection for inline form submission.')
      editorRef()?.focus()
    }
  }

  const handleInsertLink = (url: string) => handleInlineFormSubmit('link', url)
  const handleInsertVideo = (url: string) => handleInlineFormSubmit('video', url)

  // Media handling
  const handleAudioUpload = (audioItems: MediaItem[]) => {
    saveSelection()
    if (handleAudioUploaderResult(audioItems, editorRef() || null)) {
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
    }
    editorRef()?.focus()
    restoreSelection()
    hideModal()
  }

  const showAudioUploader = () => {
    saveSelection()

    // Используем новую систему колбэков через UI контекст
    showModal(MODALS.uploadAudio, undefined, {
      onSuccess: handleAudioUpload,
      onCancel: () => {
        hideModal()
        editorRef()?.focus()
        restoreSelection()
      }
    })
  }

  const handleUploadSuccess = (uploadedFile?: UploadedFile) => {
    if (!uploadedFile) return
    const currentImage = editingImage()
    if (currentImage) {
      const imgElement = currentImage as HTMLImageElement
      imgElement.src = uploadedFile.url
      imgElement.alt = uploadedFile.originalFilename || 'Uploaded image'
      setEditingImage(null)
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
    } else if (restoreSelection()) {
      replaceSelection(
        `<img src="${uploadedFile.url}" alt="${uploadedFile.originalFilename || 'Uploaded image'}" />`,
        editorRef() || null
      )
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
    }
    hideModal()
    editorRef()?.focus()
  }

  const showImageUploadModal = () => {
    saveSelection()

    // Используем новую систему колбэков через UI контекст
    showModal(MODALS.uploadImage, undefined, {
      onSuccess: handleUploadSuccess,
      onCancel: () => {
        hideModal()
        editorRef()?.focus()
        restoreSelection()
      }
    })
  }

  return {
    showInlineForm,
    handleInlineFormSubmit,
    handleInsertLink,
    handleInsertVideo,
    showAudioUploader,
    showImageUploadModal,
    handleUploadSuccess,
    editorFormOptions: () => editorFormOptions
  }
}
