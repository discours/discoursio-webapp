/**
 * @module actions
 * @description Модуль для централизованного управления действиями редактора
 */

import { applyFormatting, createSelectionState, hasFormatting, removeFormatting } from '../format/format'
import { createVideoEmbed, detectVideoPlatform, insertAudio } from '../media'
import { CommandType, FormType } from './types'
import { replaceSelection } from './utils'

/**
 * Типы действий редактора
 */
export type EditorAction = {
  command: CommandType
  data?: unknown
  event?: Event | KeyboardEvent | MouseEvent | DragEvent
  editorId?: string
}

/**
 * Результат выполнения действия
 */
export interface ActionResult {
  success: boolean
  data?: unknown
  error?: string
  needsFormInput?: boolean
  formType?: FormType
}

/**
 * Контекст для выполнения действий
 */
export interface ActionContext {
  editor: HTMLElement
  editorId?: string
  onShowForm?: (type: FormType, initialValue?: string) => void
  onShowModal?: (type: string) => void
  onChange?: () => void
}

/**
 * Обрабатывает события клавиатуры в редакторе
 * @param event Событие клавиатуры
 * @param context Контекст действия
 * @returns Результат обработки
 */
export const handleKeyboardEvent = async (event: KeyboardEvent, context: ActionContext): Promise<ActionResult> => {
  const isMac = navigator.platform.includes('Mac')
  const cmdKey = isMac ? event.metaKey : event.ctrlKey

  // Горячие клавиши форматирования
  if (cmdKey && !event.shiftKey && !event.altKey) {
    const shortcuts: { [key: string]: CommandType } = {
      b: 'bold',
      i: 'italic',
      k: 'link',
      '1': 'h1',
      '2': 'h2',
      '3': 'h3',
      q: 'blockquote'
    }

    if (shortcuts[event.key]) {
      event.preventDefault()
      return await handleEditorAction({ command: shortcuts[event.key] }, context)
    }
  }

  // Специальные комбинации с Shift
  if (cmdKey && event.shiftKey && !event.altKey) {
    if (event.key.toLowerCase() === 'k') {
      // Cmd+Shift+K для удаления ссылки (используем команду link для toggle)
      event.preventDefault()
      return await handleEditorAction({ command: 'unlink' }, context)
    }
  }

  // Enter для отправки (Cmd/Ctrl+Enter)
  if (event.key === 'Enter' && cmdKey) {
    event.preventDefault()
    return {
      success: true,
      data: { action: 'submit' }
    }
  }

  // Tab для навигации между полями
  if (event.key === 'Tab' && !cmdKey && !event.altKey) {
    return {
      success: true,
      data: { action: event.shiftKey ? 'navigate-prev' : 'navigate-next' }
    }
  }

  return { success: false, error: 'Keyboard shortcut not handled' }
}

/**
 * Обрабатывает события мыши в редакторе
 * @param event Событие мыши
 * @param context Контекст действия
 * @returns Результат обработки
 */
export const handleMouseEvent = (event: MouseEvent, context: ActionContext): ActionResult => {
  const target = event.target as HTMLElement

  // Клик по ссылке
  if (target.tagName === 'A' || target.closest('a')) {
    event.preventDefault()
    const link = target.tagName === 'A' ? target : target.closest('a')
    const href = link?.getAttribute('href') || ''

    context.onShowForm?.('link', href)
    return { success: true, needsFormInput: true, formType: 'link' }
  }

  // Клик по изображению
  if (target.tagName === 'IMG') {
    event.preventDefault()
    context.onShowModal?.('uploadImage')
    return { success: true, needsFormInput: true }
  }

  return { success: false, error: 'Mouse event not handled' }
}

/**
 * Обрабатывает команды редактора с улучшенной поддержкой форм и медиа
 * @param action - Действие редактора
 * @param context - Контекст выполнения
 * @returns Результат выполнения команды
 */
export const handleEditorAction = async (action: EditorAction, context: ActionContext): Promise<ActionResult> => {
  const { command, data } = action
  const { editor } = context

  if (!editor) {
    return { success: false, error: 'Editor not found in context' }
  }

  console.log('[handleEditorAction] Processing command:', command)

  // Получаем текущее выделение
  const selection = window.getSelection()
  if (!selection) {
    return { success: false, error: 'No selection available' }
  }

  // Убедимся, что фокус на редакторе
  if (!editor.contains(selection.anchorNode)) {
    editor.focus()
  }

  // Обработка команд форматирования
  if (['bold', 'italic', 'blockquote', 'punchline', 'h1', 'h2', 'h3', 'highlight', 'unlink'].includes(command)) {
    try {
      const selectionState = createSelectionState(selection)
      if (!selectionState) {
        return { success: false, error: 'Invalid selection state' }
      }

      const isFormatActive = hasFormatting(command, selectionState)

      if (isFormatActive) {
        removeFormatting(command, selectionState)
      } else {
        applyFormatting(command, selectionState)
      }

      context.onChange?.()
      return { success: true }
    } catch (error) {
      console.error('[handleEditorAction] Format error:', error)
      return { success: false, error: String(error) }
    }
  }

  // Обработка ссылок
  if (command === 'link') {
    try {
      const selectionState = createSelectionState(selection)
      if (!selectionState) {
        return { success: false, error: 'Invalid selection state' }
      }

      // Если ссылка уже применена, удаляем ее
      if (hasFormatting(command, selectionState)) {
        removeFormatting(command, selectionState)
        context.onChange?.()
        return { success: true }
      }

      // Если передан URL, применяем ссылку
      if (typeof data === 'string' && data) {
        const link = document.createElement('a')
        link.href = data
        link.textContent = selectionState.text || data
        link.target = '_blank'
        link.rel = 'noopener noreferrer'

        if (selectionState.range) {
          selectionState.range.deleteContents()
          selectionState.range.insertNode(link)
        }

        context.onChange?.()
        return { success: true }
      }

      // Показываем форму для ввода URL
      const currentLink = selection.anchorNode?.parentElement?.closest('a')
      const initialUrl = currentLink?.getAttribute('href') || ''
      context.onShowForm?.('link', initialUrl)

      return { success: true, needsFormInput: true, formType: 'link' }
    } catch (error) {
      console.error('[handleEditorAction] Link error:', error)
      return { success: false, error: String(error) }
    }
  }

  // Обработка медиа команд
  if (command === 'video') {
    try {
      // Если передан URL, создаем видео
      if (typeof data === 'string' && data) {
        const platform = detectVideoPlatform(data)
        if (platform) {
          const embedHtml = createVideoEmbed(data)
          if (embedHtml && replaceSelection(embedHtml, editor)) {
            context.onChange?.()
            return { success: true }
          }
        }
        return { success: false, error: 'Invalid video URL' }
      }

      // Показываем форму для ввода URL
      context.onShowForm?.('video', '')
      return { success: true, needsFormInput: true, formType: 'video' }
    } catch (error) {
      console.error('[handleEditorAction] Video error:', error)
      return { success: false, error: String(error) }
    }
  }

  if (command === 'image') {
    try {
      context.onShowModal?.('uploadImage')
      return { success: true, needsFormInput: true }
    } catch (error) {
      console.error('[handleEditorAction] Image error:', error)
      return { success: false, error: String(error) }
    }
  }

  if (command === 'audio') {
    try {
      // Если передан URL, вставляем аудио
      if (typeof data === 'string' && data) {
        if (insertAudio(data, editor)) {
          context.onChange?.()
          return { success: true }
        }
        return { success: false, error: 'Failed to insert audio' }
      }

      // Показываем форму для ввода URL или загрузки
      context.onShowForm?.('audio', '')
      return { success: true, needsFormInput: true, formType: 'audio' }
    } catch (error) {
      console.error('[handleEditorAction] Audio error:', error)
      return { success: false, error: String(error) }
    }
  }

  if (command === 'embed') {
    try {
      // Если передан URL, создаем универсальный embed
      if (typeof data === 'string' && data) {
        const { createUniversalEmbed } = await import('../media/html')
        const embedHtml = await createUniversalEmbed(data)
        if (embedHtml && replaceSelection(embedHtml, editor)) {
          context.onChange?.()
          return { success: true }
        }
        return { success: false, error: 'Invalid or unsupported embed URL' }
      }

      // Показываем форму для ввода URL
      context.onShowForm?.('embed', '')
      return { success: true, needsFormInput: true, formType: 'embed' }
    } catch (error) {
      console.error('[handleEditorAction] Embed error:', error)
      return { success: false, error: String(error) }
    }
  }

  if (command === 'hr') {
    try {
      if (replaceSelection('<hr>', editor)) {
        context.onChange?.()
        return { success: true }
      }
      return { success: false, error: 'Failed to insert horizontal rule' }
    } catch (error) {
      console.error('[handleEditorAction] HR error:', error)
      return { success: false, error: String(error) }
    }
  }

  return { success: false, error: `Command "${command}" not supported` }
}
