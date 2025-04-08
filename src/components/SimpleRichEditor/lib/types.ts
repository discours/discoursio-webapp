import { EditorState } from './state'

export type EditorCommand = 'bold' | 'italic' | 'link' | 'blockquote' | 'image' | 'h1' | 'h2' | 'h3'

/**
 * Тип команды для меню, включает все возможные типы команд
 */
export type CommandType =
  | 'bold'
  | 'italic'
  | 'link'
  | 'blockquote'
  | 'image'
  | 'video'
  | 'audio'
  | 'hr'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'bg-color'

export interface CommandConfig {
  icon: string
  title: string
  shortcut?: string
}

export interface MenuProps {
  commands: EditorCommand[]
  config: Record<string, CommandConfig>
  actions: Record<string, () => void>
  state: EditorState
}

export type CommandSet = Record<EditorCommand, CommandConfig>

export interface EditorAction {
  icon: string
  title: string
  action: () => void
  isActive?: boolean
}

export interface HeadingAction extends EditorAction {
  level: 1 | 2 | 3
}

export interface FormattingAction extends EditorAction {
  command: 'bold' | 'italic' | 'link' | 'blockquote'
}

export interface MediaAction extends EditorAction {
  type: 'image' | 'video'
}

export type ToolbarAction = HeadingAction | FormattingAction | MediaAction

export type Position = {
  top?: number | 'auto' | undefined
  left?: number | 'auto' | undefined
  bottom?: number | 'auto' | undefined
  right?: number | 'auto' | undefined
}
