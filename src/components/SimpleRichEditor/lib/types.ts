import { MediaItem } from '~/graphql/generated/graphql'
import { UploadedFile } from '~/types/upload'

/**
 * Типы режимов отображения тулбара
 */
export type ToolbarMode = 'top' | 'bottom' | 'float'

/**
 * Типы полей редактора
 */
export type EditorFieldType = 'body' | 'lead' | 'about' | 'comment' | 'title'

/**
 * Типы форм для вставки контента
 */
export type FormType = 'link' | 'video' | 'audio' | 'tooltip' | 'embed' | null

/**
 * Тип команды для меню, включает все возможные типы команд
 */
export type CommandType =
  | 'bold'
  | 'italic'
  | 'link'
  | 'unlink'
  | 'blockquote'
  | 'image'
  | 'video'
  | 'audio'
  | 'media'
  | 'upload'
  | 'embed'
  | 'separator'
  | 'hr'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'bg-gray'
  | 'bg-white'
  | 'bg-black'
  | 'bg-yellow'
  | 'bg-red'
  | 'bg-green'
  | 'bg-color'
  | 'squib'
  | 'highlight'
  | 'p'
  | 'bulletList'
  | 'orderedList'
  | 'punchline'
  | 'tooltip'

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

/**
 * Конфигурация команды меню
 */
export interface CommandConfig {
  icon: string
  title: string
  shortcut?: string
}

/**
 * Состояние выделения текста
 */
export interface SelectionState {
  range: Range | null
  text: string
  isEmpty: boolean
  position: Position
}

/**
 * Состояние редактора
 */
export interface EditorState {
  id?: string
  content: string
  selection: SelectionState
  currentCommand?: CommandType
  activeFormats: Set<CommandType>
  modifiedAt?: number
  footnotes?: Record<string, string>
}

/**
 * Параметры меню редактора
 */
export interface MenuProps {
  commands: CommandType[]
  config: Record<string, CommandConfig>
  actions: Record<string, () => void>
  state: EditorState
}

/**
 * Набор команд
 */
export type CommandSet = Record<CommandType, CommandConfig>

/**
 * Базовое действие редактора
 */
export interface EditorAction {
  icon: string
  title: string
  action: () => void
  isActive?: boolean
}

/**
 * Действие создания заголовка
 */
export interface HeadingAction extends EditorAction {
  level: 1 | 2 | 3
}

/**
 * Действие форматирования текста
 */
export interface FormattingAction extends EditorAction {
  command: 'bold' | 'italic' | 'link' | 'blockquote'
}

/**
 * Действие вставки медиа
 */
export interface MediaAction extends EditorAction {
  type: 'image' | 'video'
}

/**
 * Типы действий тулбара
 */
export type ToolbarAction = HeadingAction | FormattingAction | MediaAction

export interface Position {
  top: number
  left: number
}

/**
 * Интерфейс данных редактора
 */
export interface EditorData {
  content: string // HTML контент
  plainText: string // Чистый текст
  length: number // Длина текста
  isEmpty: boolean // Пустой ли редактор
  selection?: {
    // Информация о выделении
    text: string
    isEmpty: boolean
    position?: Position
  }
}

/**
 * Свойства компонента SimpleRichEditor
 */
export interface SimpleRichEditorProps {
  onChange: (data: EditorData) => void
  toolbar?: ToolbarMode
  content?: string
  commands?: (CommandType | CommandType[][])[]
  plus?: boolean
  placeholder?: string
  autofocus?: boolean
  readOnly?: boolean
  editorId?: string
  fieldType?: EditorFieldType
  collaborative?: boolean
  onInit?: (instance: { editor: HTMLDivElement }) => void
  onCollabCursorUpdate?: (data: Position) => void
  onBlur?: () => void
  onFocus?: () => void
}

/**
 * Конфигурация инлайн-формы
 */
export interface InlineFormOptions {
  title?: string
  initialValue?: string
  placeholder?: string
  validate?: (value: string) => Promise<string> | string
  onSubmit: (value: string) => void
  onCancel?: () => void
}

/**
 * Регулярное выражение для URL адресов
 */
export const WEB_URL_REGEX = /^(https|http)?:\/\//

/**
 * Регулярное выражение для Vimeo URL
 */
export const VIMEO_URL_REGEX = /^(https?:\/\/)?(www\.)?vimeo\.com\/([0-9]+)/

/**
 * Регулярное выражение для YouTube URL
 */
export const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/

/**
 * Параметры для плюс-меню
 */
export interface PlusMenuProps {
  position: Position
  isVisible: boolean
  onEmpty?: boolean
  onClose?: () => void
  onAction: (action: CommandType) => void
  editorId?: string
}

/**
 * Параметры для меню форматирования
 */
export interface SimpleToolbarProps {
  position?: Position
  class?: string
  commands: (CommandType | CommandGroupType)[]
  onAction: (action: CommandType | CommandGroupType) => void
  currentFormats: Set<CommandType>
  onClose?: () => void
  editorId?: string
}

/**
 * Параметры SquibMenu
 */
export interface SquibMenuProps {
  targetElement: HTMLElement | null
  position: Position
  isVisible: boolean
  onAction: (action: string) => void
  onClose?: () => void
}

/**
 * Результат обработки действия в редакторе
 */
export interface ActionResult {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Функции обратного вызова для обработки медиа и форм
 */
export interface EditorCallbacks {
  showLinkForm?: (onSubmit: (url: string) => void) => void
  showVideoForm?: (onSubmit: (url: string) => void) => void
  showAudioUploader?: () => void
  showImageUploadModal?: () => void
  handleChange?: () => void
}

/**
 * Обработчики медиа-контента
 */
export interface MediaHandlers {
  onAudioUploaded: (file: UploadedFile) => void
  onVideoEmbedded: (url: string) => void
  onImageUploaded: (file: MediaItem) => void
}

/**
 * Свойства менеджера выделения
 */
export interface SelectionManagerProps {
  editor: HTMLDivElement | undefined
  onSelectionChange?: (state: SelectionState) => void
}

export interface HistoryJournal {
  undo: string[]
  redo: string[]
}

/**
 * Обработчики действий для PlusMenu
 */
export interface PlusMenuActionHandlers {
  showLinkForm?: (onSubmit: (url: string) => void) => void
  showVideoForm?: (onSubmit: (url: string) => void) => void
  showAudioUploader?: () => void
  showImageUploadModal?: () => void
  handleChange?: () => void
}
