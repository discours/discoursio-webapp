/**
 * @module actions
 * @description Модуль для централизованного управления действиями редактора
 */

import { CommandType } from './commands'
import { applyFormatting, hasFormatting, removeFormatting } from './format'
import { createSelectionState } from './format'
import { EditorState } from './state'

/**
 * Типы действий редактора
 */
export type EditorAction = {
  command: CommandType
  data?: unknown
  event?: Event
  editorId?: string
}

/**
 * Результат выполнения действия
 */
export interface ActionResult {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Обрабатывает команды редактора
 * Теперь обрабатывает команды форматирования с возможностью переключения (toggle)
 *
 * @param action - Действие редактора
 * @param state - Состояние редактора
 * @returns Результат выполнения команды
 */
export const handleEditorAction = (action: EditorAction, state: EditorState): ActionResult => {
  const { command, data, editorId } = action

  // Расширенное логирование
  console.log('handleEditorAction вызван с:', {
    command,
    editorId: editorId || 'не задан',
    stateId: state.id || 'не задан'
  })

  // Пытаемся найти редактор разными способами
  let editor: HTMLElement | null = null

  // Способ 1: Через атрибут data-editor-id
  if (editorId) {
    const editorByDataId = document.querySelector(`[data-editor-id="${editorId}"] .content`) as HTMLElement
    if (editorByDataId) {
      console.log('Редактор найден через data-editor-id')
      editor = editorByDataId
    }
  }

  // Способ 2: По классу content в активном редакторе
  if (!editor) {
    const editorByClass = document.querySelector('.content[contenteditable="true"]') as HTMLElement
    if (editorByClass) {
      console.log('Редактор найден через класс content')
      editor = editorByClass
    }
  }

  // Способ 3: Через id
  if (!editor && editorId) {
    const editorById = document.getElementById(editorId)
    if (editorById) {
      console.log('Редактор найден через id')
      editor = editorById
    }
  }

  // Способ 4: Последняя попытка - найти любой contenteditable элемент
  if (!editor) {
    const anyEditor = document.querySelector('[contenteditable="true"]') as HTMLElement
    if (anyEditor) {
      console.log('Найден произвольный contenteditable элемент')
      editor = anyEditor
    }
  }

  if (!editor) {
    console.error('Редактор не найден! Проверьте DOM:', {
      contentEditableCount: document.querySelectorAll('[contenteditable="true"]').length,
      contentClassCount: document.querySelectorAll('.content').length,
      editorIdElements: editorId ? document.querySelectorAll(`[data-editor-id="${editorId}"]`).length : 0
    })
    return { success: false, error: 'Editor not found' }
  }

  // Сохраняем текущее выделение
  const selection = window.getSelection()

  if (!selection) {
    return { success: false, error: 'No selection' }
  }

  // Обработка команд форматирования (bold, italic, blockquote и т.д.)
  if (['bold', 'italic', 'blockquote', 'punchline'].includes(command)) {
    try {
      // Устанавливаем фокус на редактор, если его нет
      if (!editor.contains(selection.anchorNode)) {
        editor.focus()
      }

      // Создаем состояние выделения
      const selectionState = createSelectionState(selection)

      if (!selectionState) {
        return { success: false, error: 'Invalid selection state' }
      }

      // Проверяем, активно ли уже форматирование
      const isFormatActive = hasFormatting(command, selectionState)

      // Если форматирование активно - удаляем его, иначе - применяем
      if (isFormatActive) {
        removeFormatting(command, selectionState)
      } else {
        applyFormatting(command, selectionState)
      }

      return { success: true }
    } catch (error) {
      console.error('Format error:', error)
      return { success: false, error: String(error) }
    }
  }

  // Обработка вставки ссылки
  if (command === 'link') {
    try {
      if (!editor.contains(selection.anchorNode)) {
        editor.focus()
      }

      const selectionState = {
        range: selection.getRangeAt(0),
        text: selection.toString(),
        isEmpty: selection.isCollapsed,
        position: {
          top: 0,
          left: 0
        }
      }

      // Если ссылка уже применена, удаляем ее
      if (hasFormatting(command, selectionState)) {
        removeFormatting(command, selectionState)
        return { success: true }
      }

      // Если передан URL, сразу применяем ссылку
      if (typeof data === 'string' && data) {
        // Создаем элемент ссылки с указанным URL
        const link = document.createElement('a')
        link.href = data
        link.textContent = selectionState.text || data

        // Если выделение пустое, вставляем ссылку с текстом URL
        if (selectionState.isEmpty) {
          selectionState.range?.insertNode(link)
        } else {
          // Иначе заменяем выделенный текст ссылкой
          selectionState.range?.deleteContents()
          selectionState.range?.insertNode(link)
        }

        return { success: true }
      }

      // Если нет URL, переключаемся в режим редактирования ссылки
      state.selection.range = selection.getRangeAt(0)
      state.currentCommand = 'link'

      return { success: true, data: { showLinkForm: true } }
    } catch (error) {
      console.error('Link error:', error)
      return { success: false, error: String(error) }
    }
  }

  // Обработка вставки видео
  if (command === 'video') {
    try {
      state.selection.range = selection.getRangeAt(0)
      state.currentCommand = 'video'

      return { success: true, data: { showVideoForm: true } }
    } catch (error) {
      console.error('Video error:', error)
      return { success: false, error: String(error) }
    }
  }

  // Обработка вставки изображения
  if (command === 'image') {
    try {
      if (!editor.contains(selection.anchorNode)) {
        editor.focus()
      }

      state.selection.range = selection.getRangeAt(0)
      state.currentCommand = 'image'

      return { success: true, data: { showImageForm: true } }
    } catch (error) {
      console.error('Image error:', error)
      return { success: false, error: String(error) }
    }
  }

  // Обработка вставки сноски
  if (command === 'footnote') {
    try {
      if (!editor.contains(selection.anchorNode)) {
        editor.focus()
      }

      state.selection.range = selection.getRangeAt(0)
      state.currentCommand = 'footnote'

      return { success: true, data: { showFootnoteForm: true } }
    } catch (error) {
      console.error('Footnote error:', error)
      return { success: false, error: String(error) }
    }
  }

  // Обработка вставки аудио
  if (command === 'audio') {
    try {
      if (!editor.contains(selection.anchorNode)) {
        editor.focus()
      }

      state.selection.range = selection.getRangeAt(0)
      state.currentCommand = 'audio'

      return { success: true, data: { showAudioForm: true } }
    } catch (error) {
      console.error('Audio error:', error)
      return { success: false, error: String(error) }
    }
  }

  return { success: false, error: `Command "${command}" not supported` }
}
