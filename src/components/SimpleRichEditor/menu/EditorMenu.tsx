import { Component, Show } from 'solid-js'
import { useUI } from '~/context/ui'
import { EditorState } from '../lib/state'
import { EditorBubbleMenu } from './EditorBubbleMenu'
import { EditorFloatingMenu } from './EditorFloatingMenu'

/**
 * Main menu component that manages both floating and bubble menus
 *
 * Handles:
 * - Showing/hiding menus based on selection state
 * - Coordinating between floating and bubble menus
 * - Delegating commands to editor
 *
 * @example
 * ```tsx
 * <EditorMenu
 *   state={editorState}
 *   showBubbleMenu={true}
 *   onBold={() => execCommand('bold')}
 *   onItalic={() => execCommand('italic')}
 *   execCommand={execCommand}
 * />
 * ```
 */
export interface EditorMenuProps {
  /** Current editor state */
  state: EditorState
  /** Whether editor is in micro mode with limited controls */
  micro?: boolean
  /** Whether to show the bubble menu */
  showBubbleMenu: boolean
  /** Whether to show the link form */
  showLinkForm: boolean
  /** Called when bold button clicked */
  onBold: () => void
  /** Called when italic button clicked */
  onItalic: () => void
  /** Called when link button clicked */
  onLink: () => void
  /** Called when blockquote button clicked */
  onBlockquote?: () => void
  /** Called when menu should close */
  onClose: () => void
  /** Function to execute editor commands */
  execCommand: (command: string, value?: string) => void
  /** Called when link button clicked in toolbar */
  handleLinkButtonClick: () => void
  /** Called when image upload requested */
  handleImageUpload: (files: File[]) => void
  /** Called when video embed requested */
  showVideoModal?: () => void
  /** Function to restore selection before executing command */
  restoreSelection?: () => boolean
  /** Whether toolbar is visible */
  isVisible: boolean
}

const noop = () => {
  /* intentionally empty */
}

export const EditorMenu: Component<EditorMenuProps> = (props) => {
  const { showModal } = useUI()
  return (
    <>
      <Show when={props.showBubbleMenu}>
        <EditorBubbleMenu
          position={props.state.selection.position || { top: 0, left: 0 }}
          format={props.state.format}
          execCommand={props.execCommand}
          onBold={props.onBold}
          onItalic={props.onItalic}
          onLink={props.onLink}
          onBlockquote={props.onBlockquote}
          onClose={props.onClose}
        />
      </Show>

      <Show when={!props.micro && props.state.selection.isEmpty}>
        <EditorFloatingMenu
          position={props.state.selection.position || { top: 0, left: 0 }}
          onAddImage={() => showModal('uploadImage')}
          onAddVideo={props.showVideoModal || noop}
          onAddLink={props.handleLinkButtonClick}
          onAddHeading={(level) => props.execCommand('formatBlock', `<h${level}>`)}
          execCommand={props.execCommand}
          restoreSelection={props.restoreSelection}
          initialText={props.state.selection.text}
        />
      </Show>
    </>
  )
}
