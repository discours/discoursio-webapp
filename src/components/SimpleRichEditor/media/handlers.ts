/**
 * @module media/handlers
 * @description Обработчики кликов по медиа-элементам в редакторе
 */

import { Accessor, Setter } from 'solid-js'
import { EditorFieldType } from '../lib/types'
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
  setCurrentSquib: Setter<HTMLElement | null>
  setShowSquibEditor: Setter<boolean>
  // Form handlers
  showInlineForm: (type: 'link' | 'video', onSubmit: (value: string) => void, initialValue?: string) => void
  showImageUploadModal: () => void
  handleInsertLink: (url: string) => void
  handleInsertTooltip: (text: string) => void
  // Utility functions
  saveSelection: () => void
}

/**
 * Creates media click handlers for the editor
 */
export const createMediaHandlers = (context: MediaHandlersContext) => {
  const {
    editorRef,
    props,
    setEditingImage,
    setCurrentSquib,
    setShowSquibEditor,
    showInlineForm,
    showImageUploadModal,
    handleInsertLink,
    saveSelection
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

    // Обработка клика по подвёрстке (squib) - определяется по наличию data-align
    if (target.closest('[data-align]')) {
      e.preventDefault()
      const squib = target.closest('[data-align]')
      if (squib) {
        setCurrentSquib(squib as HTMLElement)
        setShowSquibEditor(true)
      }
      return
    }
  }

  return {
    handleContentClick
  }
}
