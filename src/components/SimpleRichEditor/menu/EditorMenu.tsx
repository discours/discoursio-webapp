import { Component, Show } from 'solid-js'
import { EditorState } from '../lib/state'
import { EditorBubbleMenu } from './EditorBubbleMenu'
import { EditorToolbar } from './EditorToolbar'

interface EditorMenuProps {
  state: EditorState
  micro?: boolean
  showBubbleMenu: boolean
  showLinkForm: boolean
  onBold: () => void
  onItalic: () => void
  onLink: () => void
  onBlockquote?: () => void
  onClose: () => void
  execCommand: (command: string, value?: string) => void
  handleLinkButtonClick: () => void
  handleImageUpload: (files: File[]) => void
  showVideoModal?: () => void
}

export const EditorMenu: Component<EditorMenuProps> = (props) => {
  return (
    <>
      <Show when={!props.micro}>
        <EditorToolbar
          state={props.state}
          execCommand={props.execCommand}
          handleLinkButtonClick={props.handleLinkButtonClick}
          handleImageUpload={props.handleImageUpload}
          showVideoModal={props.showVideoModal}
        />
      </Show>

      <Show when={props.showBubbleMenu}>
        <EditorBubbleMenu
          position={props.state.selection.position || { top: 0, left: 0 }}
          format={{ text: props.state.format.text } as EditorState['format']}
          onBold={props.onBold}
          onItalic={props.onItalic}
          onLink={props.onLink}
          onBlockquote={props.onBlockquote}
          onClose={props.onClose}
          showLinkForm={props.showLinkForm}
          variant={props.micro ? 'micro' : 'rich'}
          execCommand={props.execCommand}
        />
      </Show>
    </>
  )
}
