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
import { calculateFormPosition } from '../lib/positioning'
import { findLinkAncestor as findLinkAncestorUtil } from '../lib/selection'
import { afterDOMUpdate } from '../lib/timing'
import { EditorFieldType, FormType, InlineFormOptions, Position } from '../lib/types'
import { replaceSelection, validateUrl } from '../lib/utils'
import {
  createUniversalPreview,
  createVideoPreview,
  detectPreviewPlatform,
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

  // Используем общую утилиту findLinkAncestor (DRY)
  const findLinkAncestor = (node: Node | null): HTMLAnchorElement | null => {
    return findLinkAncestorUtil(node, editorRef())
  }

  const showInlineForm = (type: FormType, onSubmit: (value: string) => void, initialValue?: string) => {
    if (!type) return

    // Используем утилиту calculateFormPosition (DRY)
    const position = calculateFormPosition(editorRef(), cursorPosition())
    if (position) {
      setFormPosition(position)
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
          // Применяем форматирование ссылки
          const selectionState = {
            range: currentRange,
            text: currentSelection?.toString() || url,
            isEmpty: !currentSelection || currentSelection.isCollapsed,
            position: { top: 0, left: 0 }
          }

          console.log('[handleInlineFormSubmit] Applying link formatting:', { url, selectionState })
          applyFormatting('link', selectionState)

          // Небольшая задержка для стабилизации DOM (DRY: timing)
          afterDOMUpdate(() => {
            // После applyFormatting выделение устанавливается на созданный элемент
            // Находим ссылку через новое выделение
            const newSelection = window.getSelection()
            if (newSelection && newSelection.rangeCount > 0) {
              const newRange = newSelection.getRangeAt(0)
              const container = newRange.commonAncestorContainer

              // Ищем ссылку: либо сам контейнер, либо его родитель, либо внутри контейнера
              let linkElement: HTMLAnchorElement | null = null

              if (container.nodeType === Node.ELEMENT_NODE) {
                const el = container as HTMLElement
                linkElement = el.tagName === 'A' ? (el as HTMLAnchorElement) : el.querySelector('a')
              } else {
                linkElement = container.parentElement?.closest('a') || null
              }

              if (linkElement) {
                linkElement.setAttribute('href', url)
                linkElement.setAttribute('target', '_blank')
                linkElement.setAttribute('rel', 'noopener noreferrer')
                console.log('[handleInlineFormSubmit] Link created with href:', url)
              } else {
                console.warn('[handleInlineFormSubmit] Could not find created link element')
                // Fallback: ищем все ссылки в редакторе и обновляем последнюю с href="#"
                const editor = editorRef()
                if (editor) {
                  const allLinks = editor.querySelectorAll('a[href="#"]')
                  const lastLink = allLinks[allLinks.length - 1] as HTMLAnchorElement
                  if (lastLink) {
                    lastLink.setAttribute('href', url)
                    lastLink.setAttribute('target', '_blank')
                    lastLink.setAttribute('rel', 'noopener noreferrer')
                    console.log('[handleInlineFormSubmit] Link found via fallback and updated')
                  }
                }
              }
            }

            // Сохраняем изменения
            handleChange()
            editorRef()?.focus()
          })
        } else {
          console.warn('Invalid URL for link:', url)
        }
      } else if (type === 'video' && validateVideoUrl(url)) {
        const platform = detectVideoPlatform(url)
        if (platform) {
          const previewHtml = createVideoPreview(url)
          const editor = editorRef()
          if (editor && previewHtml) {
            replaceSelection(previewHtml, editor)
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
    // Проверяем - это preview платформа?
    const { detectPreviewPlatform } = await import('../media')
    const platform = detectPreviewPlatform(url)

    // Если это preview платформа - показываем диалог выбора
    if (platform !== 'unknown') {
      // Сохраняем контекст для вставки после выбора
      const _savedSelection = saveSelection()

      // Показываем модальное окно выбора
      showModal('previewChoice', undefined, {
        data: { url, platform },
        onSuccess: async (type: 'link' | 'preview') => {
          hideModal()

          // Восстанавливаем выделение
          restoreSelection()

          if (type === 'preview') {
            // Вставляем как <preview>
            const { createUniversalPreview } = await import('../media/html')
            const previewHtml = await createUniversalPreview(url, platform)

            if (previewHtml) {
              restoreSelection()
              const editor = editorRef()
              if (editor) {
                replaceSelection(previewHtml, editor)
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
            const previewHtml = createVideoPreview(videoUrl)
            const editor = editorRef()
            if (editor && previewHtml) {
              replaceSelection(previewHtml, editor)
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

  // Новая логика для универсального preview
  const handleInsertPreview = async (url: string, insertAsText = false) => {
    // Закрываем инлайн форму
    setShowForm(null)

    // Валидируем URL
    if (!validateWebUrl(url)) {
      console.warn('Invalid preview URL:', url)
      editorRef()?.focus()
      return
    }

    // Если пользователь хочет простую текстовую ссылку - вставляем без preview
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
    const platform = detectPreviewPlatform(url)
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
            const previewHtml = createVideoPreview(videoUrl)
            const editor = editorRef()
            if (editor && previewHtml) {
              replaceSelection(previewHtml, editor)
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
      // Для остальных платформ сразу вставляем preview
      if (restoreSelection()) {
        const previewHtml = await createUniversalPreview(url)
        const editor = editorRef()
        if (editor && previewHtml) {
          replaceSelection(previewHtml, editor)
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

  const handleUploadSuccess = async (uploadedFile?: UploadedFile) => {
    console.log('[handleUploadSuccess] Called with:', uploadedFile, 'localFile:', !!uploadedFile?.localFile)

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
      hideModal()
      editorRef()?.focus()
    } else {
      const editor = editorRef()
      if (!editor) {
        console.error('[handleUploadSuccess] No editor ref available')
        return
      }

      console.log('[handleUploadSuccess] Inserting new image:', uploadedFile.url)

      // Пытаемся восстановить выделение
      const selectionRestored = restoreSelection()
      console.log('[handleUploadSuccess] Selection restored:', selectionRestored)

      // Используем правильную функцию insertImage из media/insertion
      const { insertImage } = await import('../media/insertion')

      if (!selectionRestored) {
        // Если выделение не восстановлено - фокусируем редактор
        console.warn('[handleUploadSuccess] Selection not restored, focusing editor')
        editor.focus()
      }

      // Если есть локальный файл - сначала показываем его для мгновенного превью
      let blobUrl: string | null = null
      if (uploadedFile.localFile) {
        blobUrl = URL.createObjectURL(uploadedFile.localFile)
        console.log('[handleUploadSuccess] Created blob URL for instant preview:', blobUrl)
      }

      // Вставляем изображение с blob URL (если есть) или сразу с CDN URL
      const previewUrl = blobUrl || uploadedFile.url
      const inserted = insertImage(previewUrl, editor, uploadedFile.originalFilename || 'Uploaded image')
      console.log('[handleUploadSuccess] Image inserted:', inserted)

      // Даем браузеру время обновить DOM, затем сохраняем выделение и вызываем handleChange (DRY: timing)
      afterDOMUpdate(() => {
        // Если использовали blob URL - заменяем на CDN URL
        if (blobUrl) {
          const imgElements = editor.querySelectorAll(`img[src="${blobUrl}"]`)
          imgElements.forEach((img) => {
            ;(img as HTMLImageElement).src = uploadedFile.url
            console.log('[handleUploadSuccess] Replaced blob URL with CDN URL:', uploadedFile.url)
          })
          // Освобождаем blob URL
          URL.revokeObjectURL(blobUrl)
        }

        // КРИТИЧНО: Сохраняем новое выделение после вставки изображения
        // Это предотвращает восстановление старого выделения при последующих изменениях
        saveSelection()

        handleChange(props.fieldType ? String(props.fieldType) : 'content')

        // Закрываем модальное окно и фокусируем редактор ПОСЛЕ сохранения
        hideModal()
        editorRef()?.focus()
      })
    }
  }

  const showImageUploadModal = () => {
    console.log('[showImageUploadModal] Called, current editingImage:', editingImage())
    saveSelection()

    // КРИТИЧНО: Очищаем editingImage при открытии модального окна
    // Это гарантирует что новое изображение будет вставлено, а не заменит существующее
    setEditingImage(null)
    console.log('[showImageUploadModal] Cleared editingImage for new upload')

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
    handleInsertPreview,
    handleInsertTooltip,
    showAudioUploader,
    showImageUploadModal,
    handleUploadSuccess,
    editorFormOptions: () => editorFormOptions
  }
}
