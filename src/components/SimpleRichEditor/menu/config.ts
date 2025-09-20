/**
 * @module menu/config
 * @description Конфигурация меню и групп команд для SimpleRichEditor
 */

import { CommandGroupType, CommandType } from '../lib/types'

/**
 * Конфигурация групп команд меню
 */
export type MenuGroupsType = Record<CommandGroupType, readonly CommandType[]>

export const MENU_GROUPS: MenuGroupsType = {
  text: ['bold', 'italic', 'highlight', 'p'],
  links: ['link'],
  headings: ['h1', 'h2', 'h3', 'hr'],
  quotes: ['blockquote', 'punchline', 'squib'],
  lists: ['bulletList', 'orderedList'],
  media: ['image', 'video', 'audio'],
  align: ['align-left', 'align-center', 'align-right'],
  backgrounds: ['bg-gray', 'bg-white', 'bg-black', 'bg-yellow', 'bg-red', 'bg-green', 'bg-color']
} as const

/**
 * Получает тип команды по её ID
 */
export const getCommandType = (cmd: CommandType): CommandGroupType => {
  if (['bold', 'italic', 'highlight', 'p'].includes(cmd)) return 'text'
  if (['h1', 'h2', 'h3', 'hr'].includes(cmd)) return 'headings'
  if (['blockquote', 'punchline', 'squib'].includes(cmd)) return 'quotes'
  if (['bulletList', 'orderedList'].includes(cmd)) return 'lists'
  if (['link'].includes(cmd)) return 'links'
  if (['image', 'video', 'audio'].includes(cmd)) return 'media'
  return 'text'
}

/**
 * Проверяет, является ли действие группой команд
 */
export const isGroup = (action: CommandType | CommandGroupType): boolean => Object.keys(MENU_GROUPS).includes(action)
