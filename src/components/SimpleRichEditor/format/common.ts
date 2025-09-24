/**
 * @module format/common
 * @description Единая система форматирования для SimpleRichEditor
 *
 * Заменяет дублированную логику из format.ts, actions.ts и state.ts
 * одной унифицированной системой команд.
 */

import { CommandType, SelectionState } from '../lib/types'
import { toggleBlockFormat } from './block'
import { FORMAT_CONFIG } from './config'
import { hasFormatting } from './detection'
import { applyInlineFormatting, removeInlineFormatting } from './inline'

/**
 * Результат выполнения команды форматирования
 */
export interface FormatResult {
  success: boolean
  error?: string
  needsUpdate?: boolean
}

/**
 * Контекст выполнения команды форматирования
 */
export interface FormatContext {
  editor: HTMLElement
  selection: SelectionState
  editorId?: string
}

/**
 * Единая функция для выполнения всех команд форматирования
 *
 * @param command - Команда для выполнения
 * @param context - Контекст выполнения
 * @returns Результат выполнения команды
 */
export const executeCommand = (command: CommandType, context: FormatContext): FormatResult => {
  console.log(`[executeCommand] START - Command: ${command}`, context)
  const { editor, selection } = context

  try {
    // Проверяем валидность входных данных
    if (!editor || !selection.range) {
      console.error('[executeCommand] Invalid editor or selection:', { editor: !!editor, range: !!selection.range })
      return { success: false, error: 'Invalid editor or selection' }
    }

    // Получаем конфигурацию команды
    const config = FORMAT_CONFIG[command]
    if (!config) {
      console.error(`[executeCommand] Unknown command: ${command}`)
      return { success: false, error: `Unknown command: ${command}` }
    }

    console.log(`[executeCommand] Config found for ${command}:`, config)

    // Определяем тип команды
    const isBlockCommand = ['h1', 'h2', 'h3', 'blockquote', 'p', 'punchline'].includes(command)
    const isListCommand = ['bulletList', 'orderedList'].includes(command)
    const isMediaCommand = ['image', 'video', 'audio'].includes(command)
    const isLinkCommand = command === 'link'

    // Обрабатываем команды по типам
    if (isMediaCommand || isLinkCommand) {
      // Медиа и ссылки требуют дополнительного UI
      return { success: true, error: 'Requires additional UI interaction' }
    }

    if (isListCommand) {
      // Списки обрабатываем через execCommand для совместимости
      const commandId = command === 'bulletList' ? 'insertUnorderedList' : 'insertOrderedList'
      document.execCommand(commandId, false)
      return { success: true, needsUpdate: true }
    }

    if (isBlockCommand) {
      // Блочные элементы используют специальную логику
      toggleBlockFormat(command, selection, editor)
      return { success: true, needsUpdate: true }
    }

    // Инлайн форматирование (bold, italic, highlight и т.д.)
    console.log(`[executeCommand] Processing inline command: ${command}`)
    console.log('[executeCommand] Selection state:', {
      text: selection.text,
      isEmpty: selection.isEmpty,
      range: selection.range
    })

    const isActive = hasFormatting(command, selection)
    console.log(`[executeCommand] ⭐ Command ${command} is currently active: ${isActive}`)

    if (isActive) {
      console.log(`[executeCommand] 🗑️ REMOVING formatting: ${command}`)
      removeInlineFormatting(command, selection)
      console.log(`[executeCommand] ✅ Formatting ${command} removed`)
    } else {
      console.log(`[executeCommand] ➕ APPLYING formatting: ${command}`)
      applyInlineFormatting(command, selection)
      console.log(`[executeCommand] ✅ Formatting ${command} applied`)
    }

    console.log(`[executeCommand] SUCCESS - Inline formatting completed for: ${command}`)
    return { success: true, needsUpdate: true }
  } catch (error) {
    console.error(`[executeCommand] Error executing ${command}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Проверяет, активна ли команда в текущем выделении
 *
 * @param command - Команда для проверки
 * @param selection - Текущее выделение
 * @returns true если команда активна
 */
export const isCommandActive = (command: CommandType, selection: SelectionState): boolean => {
  try {
    return hasFormatting(command, selection)
  } catch (error) {
    console.error(`[isCommandActive] Error checking ${command}:`, error)
    return false
  }
}

/**
 * Получает список доступных команд для текущего контекста
 *
 * @param context - Контекст редактора
 * @returns Список доступных команд
 */
export const getAvailableCommands = (_context: FormatContext): CommandType[] => {
  // Базовый набор команд, всегда доступных
  const baseCommands: CommandType[] = [
    'bold',
    'italic',
    'link',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'bulletList',
    'orderedList'
  ]

  // В будущем можно добавить логику для определения доступности
  // команд в зависимости от контекста (например, в заголовке недоступны списки)

  return baseCommands
}
