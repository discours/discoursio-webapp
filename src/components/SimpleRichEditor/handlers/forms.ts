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
import {
  createUniversalEmbed,
  createVideoEmbed,
  detectEmbedPlatform,
  detectVideoPlatform,
  handleAudioUploaderResult
} from '../media'

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

  // Специальная версия для плюсменю - принимает позицию как параметр
  const showInlineFormAtPosition = (
    type: FormType,
    position: Position,
    onSubmit: (value: string) => void,
    initialValue?: string
  ) => {
    if (!type) return

    // Используем переданную позицию напрямую
    setFormPosition({
      top: position.top + window.scrollY,
      left: position.left + window.scrollX
    })

    // Устанавливаем начальное значение
    setFormInitialValue(initialValue || '')

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
      } else if (type === 'tooltip') {
        const currentSelection = window.getSelection()
        const currentRange = currentSelection?.rangeCount ? currentSelection.getRangeAt(0) : null

        if (url.trim() === '') {
          // Удаляем tooltip
          removeFormatting('tooltip', {
            range: currentRange,
            text: currentSelection?.toString() || '',
            isEmpty: !currentSelection || currentSelection.isCollapsed,
            position: { top: 0, left: 0 }
          })
        } else {
          const caption = currentSelection?.toString() || url
          applyFormatting('tooltip', {
            range: currentRange,
            text: `<tooltip>${caption}</tooltip>`,
            isEmpty: !currentSelection || currentSelection.isCollapsed,
            position: { top: 0, left: 0 }
          })
        }
      } else {
        console.warn(`Invalid content for ${type}:`, url)
      }
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
      editorRef()?.focus()
    } else {
      console.warn('Could not restore selection for inline form submission.')
      editorRef()?.focus()
    }
  }

  const handleInsertLink = async (url: string) => {
    // Проверяем - это embed платформа?
    const { detectEmbedPlatform } = await import('../media')
    const platform = detectEmbedPlatform(url)

    // Если это embed платформа - показываем диалог выбора
    if (platform !== 'unknown') {
      // Сохраняем контекст для вставки после выбора
      const _savedSelection = saveSelection()

      // Показываем модальное окно выбора
      showModal('embedChoice', undefined, {
        data: { url, platform },
        onSuccess: async (type: 'link' | 'embed') => {
          hideModal()

          // Восстанавливаем выделение
          restoreSelection()

          if (type === 'embed') {
            // Вставляем как <embed>
            const { createUniversalEmbed } = await import('../media/html')
            const embedHtml = await createUniversalEmbed(url, platform)

            if (embedHtml) {
              restoreSelection()
              const editor = editorRef()
              if (editor) {
                replaceSelection(embedHtml, editor)
                handleChange(props.fieldType ? String(props.fieldType) : 'content')
              }
            }
          } else {
            // Вставляем как обычную ссылку <a>
            handleInlineFormSubmit('link', url)
          }

          editorRef()?.focus()
        },
        onCancel: () => {
          hideModal()
          editorRef()?.focus()
          restoreSelection()
        }
      })
    } else {
      // Обычная ссылка - вставляем как раньше
      handleInlineFormSubmit('link', url)
    }
  }

  // Новая логика для видео - показываем модальное окно с превью
  const handleInsertVideo = (url: string) => {
    // Закрываем инлайн форму
    setShowForm(null)

    // Валидируем URL
    if (!validateVideoUrl(url)) {
      console.warn('Invalid video URL:', url)
      editorRef()?.focus()
      return
    }

    // Показываем модальное окно с превью, передавая URL через data
    showModal(MODALS.insertVideo, undefined, {
      data: { videoUrl: url }, // Передаем URL через data
      onSuccess: (videoUrl: string) => {
        // Вставляем видео после подтверждения в модальном окне
        if (restoreSelection()) {
          const platform = detectVideoPlatform(videoUrl)
          if (platform) {
            const embedHtml = createVideoEmbed(videoUrl)
            const editor = editorRef()
            if (editor && embedHtml) {
              replaceSelection(embedHtml, editor)
            }
          }
          handleChange(props.fieldType ? String(props.fieldType) : 'content')
          editorRef()?.focus()
        }
        hideModal()
      },
      onCancel: () => {
        hideModal()
        editorRef()?.focus()
        restoreSelection()
      }
    })
  }

  const handleInsertTooltip = (text: string) => handleInlineFormSubmit('tooltip', text)

  // Новая логика для универсального embed
  const handleInsertEmbed = async (url: string, insertAsText = false) => {
    // Закрываем инлайн форму
    setShowForm(null)

    // Валидируем URL
    if (!validateWebUrl(url)) {
      console.warn('Invalid embed URL:', url)
      editorRef()?.focus()
      return
    }

    // Если пользователь хочет простую текстовую ссылку - вставляем без embed
    if (insertAsText) {
      if (restoreSelection()) {
        const editor = editorRef()
        if (editor) {
          // Вставляем как обычную ссылку
          replaceSelection(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`, editor)
          handleChange(props.fieldType ? String(props.fieldType) : 'content')
        }
        editorRef()?.focus()
      }
      return
    }

    // Определяем платформу
    const platform = detectEmbedPlatform(url)
    if (platform === 'unknown') {
      // Если платформа не распознана, вставляем как текстовую ссылку
      if (restoreSelection()) {
        const editor = editorRef()
        if (editor) {
          replaceSelection(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`, editor)
          handleChange(props.fieldType ? String(props.fieldType) : 'content')
        }
        editorRef()?.focus()
      }
      return
    }

    // Для YouTube и Vimeo показываем модальное окно с превью
    if (platform === 'youtube' || platform === 'vimeo') {
      showModal(MODALS.insertVideo, undefined, {
        data: { videoUrl: url },
        onSuccess: (videoUrl: string) => {
          if (restoreSelection()) {
            const embedHtml = createVideoEmbed(videoUrl)
            const editor = editorRef()
            if (editor && embedHtml) {
              replaceSelection(embedHtml, editor)
            }
            handleChange(props.fieldType ? String(props.fieldType) : 'content')
            editorRef()?.focus()
          }
          hideModal()
        },
        onCancel: () => {
          hideModal()
          editorRef()?.focus()
          restoreSelection()
        }
      })
    } else {
      // Для остальных платформ сразу вставляем embed
      if (restoreSelection()) {
        const embedHtml = await createUniversalEmbed(url)
        const editor = editorRef()
        if (editor && embedHtml) {
          replaceSelection(embedHtml, editor)
          handleChange(props.fieldType ? String(props.fieldType) : 'content')
        }
        editorRef()?.focus()
      }
    }
  }

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
    console.log('[handleUploadSuccess] Called with:', uploadedFile)

    if (!uploadedFile) {
      console.warn('[handleUploadSuccess] No uploadedFile provided')
      return
    }

    const currentImage = editingImage()
    console.log('[handleUploadSuccess] Current editing image:', currentImage)

    if (currentImage) {
      const imgElement = currentImage as HTMLImageElement
      imgElement.src = uploadedFile.url
      imgElement.alt = uploadedFile.originalFilename || 'Uploaded image'
      console.log('[handleUploadSuccess] Updated existing image:', { src: imgElement.src, alt: imgElement.alt })
      setEditingImage(null)
      handleChange(props.fieldType ? String(props.fieldType) : 'content')
    } else {
      const selectionRestored = restoreSelection()
      console.log('[handleUploadSuccess] Selection restored:', selectionRestored)

      if (selectionRestored) {
        const imgHtml = `<img src="${uploadedFile.url}" alt="${uploadedFile.originalFilename || 'Uploaded image'}" />`
        console.log('[handleUploadSuccess] Inserting image HTML:', imgHtml)

        const inserted = replaceSelection(imgHtml, editorRef() || null)
        console.log('[handleUploadSuccess] Image inserted:', inserted)

        handleChange(props.fieldType ? String(props.fieldType) : 'content')
      } else {
        console.error('[handleUploadSuccess] Failed to restore selection - image NOT inserted')
      }
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
    showInlineFormAtPosition,
    handleInlineFormSubmit,
    handleInsertLink,
    handleInsertVideo,
    handleInsertEmbed,
    handleInsertTooltip,
    showAudioUploader,
    showImageUploadModal,
    handleUploadSuccess,
    editorFormOptions: () => editorFormOptions
  }
}
