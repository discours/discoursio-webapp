import { Component, Show } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { useLocalize } from '~/context/localize'
import { EditorState } from '../lib/state'
import { SimpleInsertLinkForm } from './SimpleInsertLinkForm'
import { SimpleToolbarControl as Control } from './SimpleToolbarControl'

import styles from './EditorBubbleMenu.module.scss'

/**
 * Bubble menu component that appears when text is selected
 *
 * Features:
 * - Text formatting controls (bold, italic)
 * - Link insertion
 * - Blockquote toggling
 * - Keyboard shortcuts hints
 * - Position following selection
 * - Micro/rich variants
 *
 * @example
 * ```tsx
 * <EditorBubbleMenu
 *   position={{ top: 100, left: 200 }}
 *   format={editorState.format}
 *   onBold={() => execCommand('bold')}
 *   onItalic={() => execCommand('italic')}
 *   onLink={() => showLinkForm()}
 *   variant="rich"
 * />
 * ```
 */
interface BubbleMenuProps {
  /** Position where menu should be rendered */
  position: { top: number; left: number }
  /** Current text formatting state */
  format: EditorState['format']
  /** Called when bold button clicked */
  onBold: () => void
  /** Called when italic button clicked */
  onItalic: () => void
  /** Called when link button clicked */
  onLink: () => void
  /** Called when blockquote button clicked */
  onBlockquote?: () => void
  /** Called when menu should close */
  onClose?: () => void
  /** Whether to show link form instead of controls */
  showLinkForm?: boolean
  /** Called when link form closed */
  onLinkFormClose?: () => void
  /** Menu variant - micro has minimal controls */
  variant?: 'micro' | 'rich'
  /** Function to execute editor commands */
  execCommand: (command: string, value?: string) => void
}

export const EditorBubbleMenu: Component<BubbleMenuProps> = (props) => {
  const { t } = useLocalize()
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
          >
            {(setAnchorEl) => <button ref={setAnchorEl}>{t('Add link')}</button>}
          </SimpleInsertLinkForm>
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
              caption={t('Remove blockquote')}
              isActive={props.format.block.blockquote}
              onChange={() => props.onBlockquote?.()}
            >
              <Icon name="editor-quote" />
            </Control>
          </Show>
        </div>
      </Show>
    </div>
  )
}
