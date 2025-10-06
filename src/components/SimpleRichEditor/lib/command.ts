/**
 * @module lib/commandUtils
 * @description Утилиты для работы с командами редактора (DRY consolidation)
 */

import { CommandType } from './types'

/**
 * Блочные команды (заголовки, цитаты, параграфы)
 */
export const BLOCK_COMMANDS: readonly CommandType[] = [
  'h1',
  'h2',
  'h3',
  'blockquote',
  'p',
  'punchline',
  'incut'
] as const

/**
 * Команды списков
 */
export const LIST_COMMANDS: readonly CommandType[] = ['bulletList', 'orderedList'] as const

/**
 * Медиа команды (изображения, видео, аудио)
 */
export const MEDIA_COMMANDS: readonly CommandType[] = ['image', 'video', 'audio'] as const

/**
 * Инлайн команды форматирования текста
 */
export const INLINE_COMMANDS: readonly CommandType[] = ['bold', 'italic', 'highlight', 'link'] as const

/**
 * Команды, требующие UI взаимодействия (формы, модалки)
 */
export const UI_COMMANDS: readonly CommandType[] = ['link', 'tooltip', 'image', 'video', 'audio', 'embed'] as const

/**
 * Проверяет, является ли команда блочной
 * Консолидирует логику из format/common.ts, format/format.ts, format/selection-utils.ts
 *
 * @param command - Команда для проверки
 * @returns true если команда блочная
 */
export const isBlockCommand = (command: CommandType): boolean => {
  return (BLOCK_COMMANDS as readonly string[]).includes(command)
}

/**
 * Проверяет, является ли команда командой списка
 * Консолидирует логику из format/common.ts, format/format.ts
 *
 * @param command - Команда для проверки
 * @returns true если команда списка
 */
export const isListCommand = (command: CommandType): boolean => {
  return (LIST_COMMANDS as readonly string[]).includes(command)
}

/**
 * Проверяет, является ли команда медиа командой
 * Консолидирует логику из format/common.ts
 *
 * @param command - Команда для проверки
 * @returns true если команда медиа
 */
export const isMediaCommand = (command: CommandType): boolean => {
  return (MEDIA_COMMANDS as readonly string[]).includes(command)
}

/**
 * Проверяет, является ли команда инлайн командой
 *
 * @param command - Команда для проверки
 * @returns true если команда инлайн
 */
export const isInlineCommand = (command: CommandType): boolean => {
  return (INLINE_COMMANDS as readonly string[]).includes(command)
}

/**
 * Проверяет, требует ли команда UI взаимодействия
 * Консолидирует логику из SimpleRichEditor.tsx
 *
 * @param command - Команда для проверки
 * @returns true если команда требует UI
 */
export const requiresUI = (command: CommandType): boolean => {
  return (UI_COMMANDS as readonly string[]).includes(command)
}

/**
 * Проверяет, является ли команда командой ссылки
 *
 * @param command - Команда для проверки
 * @returns true если команда ссылки
 */
export const isLinkCommand = (command: CommandType): boolean => {
  return command === 'link'
}

/**
 * Получает execCommand ID для команды списка
 *
 * @param command - Команда списка
 * @returns ID для document.execCommand или null
 */
export const getListExecCommandId = (command: CommandType): string | null => {
  if (command === 'bulletList') return 'insertUnorderedList'
  if (command === 'orderedList') return 'insertOrderedList'
  return null
}

/**
 * Группирует команды по категориям для отладки
 *
 * @param command - Команда для анализа
 * @returns Объект с флагами категорий
 */
export const categorizeCommand = (command: CommandType) => {
  return {
    isBlock: isBlockCommand(command),
    isList: isListCommand(command),
    isMedia: isMediaCommand(command),
    isInline: isInlineCommand(command),
    requiresUI: requiresUI(command),
    isLink: isLinkCommand(command)
  }
}
