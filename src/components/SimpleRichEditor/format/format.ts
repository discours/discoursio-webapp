/**
 * @module format/format
 * @description Главный модуль форматирования - объединяет все типы форматирования
 */

import { CommandType, SelectionState } from '../lib/types'
import { toggleBlockFormat } from './block'
import { FORMAT_CONFIG } from './config'
import { hasFormatting } from './detection'
import { applyInlineFormatting, removeInlineFormatting } from './inline'

// Экспортируем типы из других модулей для обратной совместимости
export type { SelectionState } from '../lib/types'

/**
 * Определяет структуру состояния форматирования
 */
export type FormattingState = {
  text: {
    bold: boolean
    italic: boolean
    link: boolean
  }
  block: {
    blockquote: boolean
    punchline: boolean
  }
}

export { resetFormat, toggleBlockFormat } from './block'
// Экспортируем конфигурацию из отдельного модуля
export { createElement, FORMAT_CONFIG } from './config'
export { getActiveFormats, hasFormatting } from './detection'
// Экспортируем функции из специализированных модулей
export { applyInlineFormatting as applyFormatting, removeInlineFormatting as removeFormatting } from './inline'

/**
 * Универсальная функция для применения/удаления форматирования
 */
export const toggleFormatting = (
  command: CommandType,
  state: SelectionState,
  editorRoot?: HTMLElement | null
): { success: boolean; error?: string } => {
  if (!state.range) {
    return { success: false, error: 'Нет выделения' }
  }

  const config = FORMAT_CONFIG[command]
  if (!config) {
    return { success: false, error: `Неизвестная команда: ${command}` }
  }

  try {
    const isBlockCommand = ['h1', 'h2', 'h3', 'blockquote', 'p'].includes(command)
    const isListCommand = ['bulletList', 'orderedList'].includes(command)
    const isFormatActive = hasFormatting(command, state)

    if (isBlockCommand && editorRoot) {
      toggleBlockFormat(command, state, editorRoot)
    } else if (isListCommand) {
      const commandId = command === 'bulletList' ? 'insertUnorderedList' : 'insertOrderedList'
      document.execCommand(commandId, false)
    } else if (isFormatActive) {
      removeInlineFormatting(command, state)
    } else {
      applyInlineFormatting(command, state)
    }

    return { success: true }
  } catch (error) {
    console.error(`[toggleFormatting] Error for command ${command}:`, error)
    return { success: false, error: String(error) }
  }
}

// Вспомогательные функции для обратной совместимости
export const createSelectionState = (selection: Selection | null): SelectionState | null => {
  if (!selection || selection.rangeCount === 0) return null

  return {
    range: selection.getRangeAt(0),
    text: selection.toString(),
    isEmpty: selection.isCollapsed,
    position: {
      top: selection.anchorOffset,
      left: selection.anchorOffset
    }
  }
}

export const getCurrentFormats = (selection: Selection | null): FormattingState => {
  const formats: FormattingState = {
    text: {
      bold: false,
      italic: false,
      link: false
    },
    block: {
      blockquote: false,
      punchline: false
    }
  }

  if (!selection || selection.rangeCount === 0) return formats

  const state = createSelectionState(selection)
  if (!state) return formats

  formats.text.bold = hasFormatting('bold', state)
  formats.text.italic = hasFormatting('italic', state)
  formats.text.link = hasFormatting('link', state)
  formats.block.blockquote = hasFormatting('blockquote', state)
  formats.block.punchline = hasFormatting('punchline', state)

  return formats
}
