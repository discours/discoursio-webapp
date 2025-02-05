import { Component, Show } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { EditorState } from '../lib/state'
import { SimpleInsertLinkForm } from './SimpleInsertLinkForm'
import { SimpleToolbarControl as Control } from './SimpleToolbarControl'

import styles from './EditorBubbleMenu.module.scss'

interface BubbleMenuProps {
  position: { top: number; left: number }
  format: EditorState['format']
  onBold: () => void
  onItalic: () => void
  onLink: () => void
  onBlockquote?: () => void
  onClose: () => void
  showLinkForm?: boolean
  onLinkFormClose?: () => void
  variant?: 'micro' | 'rich'
  execCommand: (command: string, value?: string) => void
}

export const EditorBubbleMenu: Component<BubbleMenuProps> = (props) => {
  return (
    <div
      class={styles.bubbleMenu}
      style={{
        top: `${props.position.top}px`,
        left: `${props.position.left}px`,
        transform: props.variant === 'micro' ? 'translate(-50%, -100%)' : undefined
      }}
    >
      <Show
        when={!props.showLinkForm}
        fallback={
          <SimpleInsertLinkForm
            class={styles.linkForm}
            onClose={props.onLinkFormClose}
            onSubmit={(url: string) => {
              props.onLink()
              props.onLinkFormClose?.()
              props.execCommand('createLink', url)
            }}
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <div class={styles.controls}>
          <Control key="bold" isActive={props.format.text.bold} onChange={props.onBold} caption="Bold (⌘B)">
            <Icon name="editor-bold" />
          </Control>

          <Control
            key="italic"
            isActive={props.format.text.italic}
            onChange={props.onItalic}
            caption="Italic (⌘I)"
          >
            <Icon name="editor-italic" />
          </Control>

          <Control key="link" isActive={props.format.text.link} onChange={props.onLink} caption="Link (⌘K)">
            <Icon name="editor-link" />
          </Control>

          <Show when={props.format.block.blockquote && props.onBlockquote}>
            <Control
              key="blockquote"
              isActive={props.format.block.blockquote}
              onChange={props.onBlockquote}
              caption="Remove blockquote"
            >
              <Icon name="editor-quote" />
            </Control>
          </Show>
        </div>
      </Show>
    </div>
  )
}
