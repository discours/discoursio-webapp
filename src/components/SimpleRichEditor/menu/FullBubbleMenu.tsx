import { Component } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { Popover } from '~/components/_shared/Popover/Popover'
import { useLocalize } from '~/context/localize'
import { EditorState } from '../lib/state'
import { SimpleInsertLinkForm } from './SimpleInsertLinkForm'

import styles from './FullBubbleMenu.module.scss'

/**
 * Bubble menu shown when text is selected
 *
 * Provides formatting controls:
 * - Bold
 * - Italic
 * - Link
 * - Blockquote
 *
 * Menu follows text selection and updates button states based on current format
 *
 * @example
 * ```tsx
 * <FullBubbleMenu
 *   position={{ top: 100, left: 200 }}
 *   format={editorState.format}
 *   onBold={() => toggleBold()}
 *   onItalic={() => toggleItalic()}
 *   onLink={() => addLink()}
 *   onBlockquote={() => toggleQuote()}
 * />
 * ```
 */
export const FullBubbleMenu: Component<FullBubbleMenuProps> = (props) => {
  const { t } = useLocalize()

  return (
    <div
      class={styles.FullBubbleMenu}
      style={{
        position: 'absolute',
        top: `${props.position.top + 24}px`,
        left: `${props.position.left}px`
      }}
    >
      <div class={styles.mainControls}>
        <Popover content={t('Bold')}>
          {(setAnchorEl) => (
            <button
              ref={setAnchorEl}
              class={styles.actionButton}
              onClick={props.onBold}
              data-active={props.format.text.bold}
            >
              <Icon name="editor-bold" />
            </button>
          )}
        </Popover>

        <Popover content={t('Italic')}>
          {(setAnchorEl) => (
            <button
              ref={setAnchorEl}
              class={styles.actionButton}
              onClick={props.onItalic}
              data-active={props.format.text.italic}
            >
              <Icon name="editor-italic" />
            </button>
          )}
        </Popover>

        <SimpleInsertLinkForm
          onSubmit={props.onLink}
          execCommand={props.execCommand}
          restoreSelection={props.restoreSelection}
          initialText={props.initialText}
        >
          {(setAnchorEl) => (
            <button ref={setAnchorEl} class={styles.actionButton} data-active={props.format.text.link}>
              <Icon name="editor-link" />
            </button>
          )}
        </SimpleInsertLinkForm>
      </div>

      <div class={styles.delimiter} />

      <div class={styles.blockControls}>
        <Popover content={t('Quote')}>
          {(setAnchorEl) => (
            <button
              ref={setAnchorEl}
              class={styles.actionButton}
              onClick={props.onBlockquote}
              data-active={props.format.block.blockquote}
            >
              <Icon name="editor-quote" />
            </button>
          )}
        </Popover>
      </div>
    </div>
  )
}

interface FullBubbleMenuProps {
  /** Position where menu should be rendered */
  position: { top: number; left: number }
  /** Current text formatting state */
  format: EditorState['format']
  /** Function to execute editor commands */
  execCommand: (command: string, value?: string) => void
  /** Called when bold button clicked */
  onBold: () => void
  /** Called when italic button clicked */
  onItalic: () => void
  /** Called when link button clicked */
  onLink: () => void
  /** Called when blockquote button clicked */
  onBlockquote: () => void
  /** Called when menu should close */
  onClose: () => void
  /** Function to restore selection before executing command */
  restoreSelection?: () => boolean
  /** Currently selected text */
  initialText?: string
}
