import { CommandGroupType, CommandType } from './types'

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

  ['link'], // в строку

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

/**
 * Проверяет, активно ли указанное форматирование
 * @param format Формат для проверки
 * @param editor Ссылка на редактор
 * @returns true, если формат активен
 */
export const isActive = (format: string, editor: HTMLElement | null = null): boolean => {
  if (typeof document === 'undefined') return false

  // Получаем выделение
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return false

  // Проверяем, находится ли выделение в указанном редакторе
  if (editor) {
    const range = selection.getRangeAt(0)
    const isInEditor = editor.contains(range.commonAncestorContainer)
    if (!isInEditor) return false
  }

  // Проверяем наличие указанного формата используя современное Selection и Range API
  try {
    const range = selection.getRangeAt(0)
    const parentElement =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : (range.commonAncestorContainer as HTMLElement)

    if (!parentElement) return false

    // Проверяем формат в зависимости от типа
    switch (format) {
      case 'bold':
        return !!parentElement.closest('strong, b')
      case 'italic':
        return !!parentElement.closest('em, i')
      case 'underline':
        return !!parentElement.closest('u')
      case 'strikethrough':
        return !!parentElement.closest('strike, s')
      case 'link':
        return !!parentElement.closest('a')
      case 'blockquote':
        return !!parentElement.closest('blockquote')
      case 'h1':
        return !!parentElement.closest('h1')
      case 'h2':
        return !!parentElement.closest('h2')
      case 'h3':
        return !!parentElement.closest('h3')
      case 'bulletList':
        return !!parentElement.closest('ul')
      case 'orderedList':
        return !!parentElement.closest('ol')
      case 'highlight':
        return !!parentElement.closest('mark')
      default: {
        // Вместо устаревшего document.queryCommandState используем проверку через DOM
        const tagName = getTagForCommand(format as CommandType)
        if (tagName) {
          return !!parentElement.closest(tagName)
        }
        console.warn(`[isActive] Unsupported format ${format}`)
        return false
      }
    }
  } catch (e) {
    console.error(`[Commands] Error checking format ${format}:`, e)
    return false
  }
}

export const isGroup = (action: CommandType | CommandGroupType) => Object.keys(MENU_GROUPS).includes(action)
