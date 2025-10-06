/**
 * @module media/handlers
 * @description Обработчики кликов по медиа-элементам в редакторе
 */

import { Accessor, Setter } from 'solid-js'
import { EditorFieldType, Position } from '../lib/types'
import { getOrCreateSelection } from '../lib/utils'

/**
 * Контекст для медиа-обработчиков
 */
export interface MediaHandlersContext {
  editorRef: Accessor<HTMLDivElement | undefined>
  props: {
    readOnly?: boolean
    fieldType?: EditorFieldType
  }
  // State setters
  setEditingImage: Setter<HTMLElement | null>
  setCurrentIncut: Setter<HTMLElement | null>
  setShowIncutEditor: Setter<boolean>
  setIncutMenuPosition: Setter<Position>
  // Form handlers
  showInlineForm: (type: 'link' | 'video', onSubmit: (value: string) => void, initialValue?: string) => void
  showImageUploadModal: () => void
  handleInsertLink: (url: string) => void
  handleInsertTooltip: (text: string) => void
  // Utility functions
  saveSelection: () => void
  calculateIncutMenuPosition: (incutElement: HTMLElement) => Position
}

/**
 * Creates media click handlers for the editor
 */
export const createMediaHandlers = (context: MediaHandlersContext) => {
  const {
    editorRef,
    props,
    setEditingImage,
    setCurrentIncut,
    setShowIncutEditor,
    setIncutMenuPosition,
    showInlineForm,
    showImageUploadModal,
    handleInsertLink,
    saveSelection,
    calculateIncutMenuPosition
  } = context

  const handleContentClick = (e: MouseEvent) => {
    if (!editorRef() || props.readOnly) return
    const target = e.target as HTMLElement

    // Обработка клика по ссылке
    if (target.tagName === 'A' || target.closest('a')) {
      e.preventDefault()
      const link = target.tagName === 'A' ? target : target.closest('a')

      // Для обычных ссылок - показываем форму редактирования
      const href = link?.getAttribute('href') || ''

      // Выделяем ссылку для правильного редактирования
      if (link) {
        const ed = editorRef()
        if (ed) {
          const selectionData = getOrCreateSelection(ed)
          if (selectionData) {
            const { selection } = selectionData
            const range = document.createRange()
            range.selectNodeContents(link)
            selection.removeAllRanges()
            selection.addRange(range)
            saveSelection()
          }
        }
      }

      // Показываем форму с текущим URL ссылки
      showInlineForm('link', handleInsertLink, href)
      return
    }

    // Обработка клика по изображению
    if (target.tagName === 'IMG') {
      e.preventDefault()
      setEditingImage(target)
      showImageUploadModal()
      return
    }

    // Обработка клика по подвёрстке - определяется по атрибуту data-align
    if (target.closest('[data-align]')) {
      e.preventDefault()
      const incut = target.closest('[data-align]') as HTMLElement
      if (incut) {
        console.log('[handleContentClick] Incut clicked:', incut.outerHTML)
        setCurrentIncut(incut)
        const position = calculateIncutMenuPosition(incut)
        console.log('[handleContentClick] Incut menu position:', position)
        setIncutMenuPosition(position)
        setShowIncutEditor(true)
        console.log('[handleContentClick] showIncutEditor set to true')
      }
      return
    }
  }

  return {
    handleContentClick
  }
}
