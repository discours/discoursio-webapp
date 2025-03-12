/**
 * @module commands
 * @description Модуль конфигурации команд редактора
 *
 * Определяет:
 * - Типы команд
 * - Группы команд
 * - Предустановленные наборы команд
 * - Горячие клавиши
 * - Маппинг команд в HTML теги
 */

/**
 * Типы групп команд редактора
 */
export type CommandGroupType =
  | 'text' // Базовое форматирование
  | 'headings' // Заголовки
  | 'quotes' // Цитаты и врезки
  | 'lists' // Списки
  | 'links' // Ссылки
  | 'media' // Медиа контент
  | 'align' // Выравнивание
  | 'backgrounds' // Фоны

export type CommandType =
  | 'bold'
  | 'italic'
  | 'highlight'
  | 'link'
  | 'footnote'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'hr'
  | 'blockquote'
  | 'punchline'
  | 'bulletList'
  | 'orderedList'
  | 'image'
  | 'video'
  | 'audio'
  | 'p' // Сброс форматирования
  | 'squib' // Подвёртска
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'bg-gray'
  | 'bg-white'
  | 'bg-black'
  | 'bg-yellow'
  | 'bg-red'
  | 'bg-green'

/**
 * Конфигурация групп команд меню
 */
export const MENU_GROUPS: Record<CommandGroupType, CommandType[]> = {
  text: ['bold', 'italic', 'highlight', 'p'],
  links: ['link', 'footnote'],
  headings: ['h1', 'h2', 'h3', 'hr'],
  quotes: ['blockquote', 'punchline', 'squib'],
  lists: ['bulletList', 'orderedList'],
  media: ['image', 'video', 'audio'],
  align: ['align-left', 'align-center', 'align-right'],
  backgrounds: ['bg-gray', 'bg-white', 'bg-black', 'bg-yellow', 'bg-red', 'bg-green']
} as const

/**
 * Получает тип команды по её ID
 */
export const getCommandType = (cmd: CommandType): CommandGroupType => {
  if (['bold', 'italic', 'highlight', 'p'].includes(cmd)) return 'text'
  if (['h1', 'h2', 'h3'].includes(cmd)) return 'headings'
  if (['blockquote', 'punchline', 'squib'].includes(cmd)) return 'quotes'
  if (['bulletList', 'orderedList'].includes(cmd)) return 'lists'
  if (['link', 'footnote'].includes(cmd)) return 'links'
  if (['image', 'video', 'audio'].includes(cmd)) return 'media'
  return 'text'
}

/**
 * Предустановленные наборы команд
 */
export const PLUS_COMMANDS = [['image', 'video', 'audio', 'hr']] as const
export const MICRO_COMMANDS = ['bold', 'italic', 'link'] as const
export const MINI_COMMANDS = ['bold', 'italic', 'link', 'blockquote', 'image'] as const
export const FULL_COMMANDS = [
  // Группа форматирования текста
  [
    [
      // кнопка с иконкой editor-headings
      ['h1', 'h2', 'h3'], // Заголовки
      ['blockquote', 'punchline', 'squib'] // Цитаты и врезки
    ]
  ],

  // разделитель

  ['bold', 'italic', 'highlight'], // в строку

  // разделитель

  ['link', 'footnote'], // в строку

  // разделитель

  // кнопка с иконкой editor-lists
  [
    [
      // кнопка с иконкой editor-lists
      ['bulletList', 'orderedList'] // lists
    ]
  ] // выпадающий список
] as const
/**
 * Конфигурация горячих клавиш
 */
export const KEYBOARD_SHORTCUTS = {
  'mod+b': 'bold',
  'mod+i': 'italic',
  'mod+u': 'underline',
  'mod+k': 'link'
} as const

/**
 * Возвращает HTML тег для команды форматирования
 */
export const getTagForCommand = (cmd: CommandType): string => {
  switch (cmd) {
    case 'bold':
      return 'strong'
    case 'italic':
      return 'em'
    case 'highlight':
      return 'mark'
    case 'bulletList':
      return 'ul'
    case 'orderedList':
      return 'ol'
    case 'h1':
    case 'h2':
    case 'h3':
    case 'hr':
    case 'p':
    case 'blockquote':
      return cmd
    case 'punchline':
      return 'div'
    default:
      return 'span'
  }
}

export const isActive = (cmd: CommandType, editor: HTMLDivElement) => {
  const selection = window.getSelection()
  const range = selection?.getRangeAt(0)
  const node = editor?.querySelector(getTagForCommand(cmd)) || null
  return node && range?.intersectsNode(node as Node)
}

export const isGroup = (action: CommandType | CommandGroupType) => Object.keys(MENU_GROUPS).includes(action)
