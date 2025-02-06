import { EditorState } from "./state"

export type EditorCommand = 
  | 'bold' 
  | 'italic' 
  | 'link'
  | 'blockquote'
  | 'image'
  | 'h1'
  | 'h2'
  | 'h3'

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