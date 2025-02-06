import { Component, Show, createSignal } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { Popover } from '~/components/_shared/Popover/Popover'
import { useLocalize } from '~/context/localize'
import { SimpleInsertLinkForm } from './SimpleInsertLinkForm'
import { SimpleInsertVideoForm } from './SimpleInsertVideoForm'

import styles from './EditorFloatingMenu.module.scss'

/**
 * Floating menu for inserting content when cursor is at empty position
 *
 * Shows a "+" button that opens a menu with options to:
 * - Add headings
 * - Insert images
 * - Embed videos
 * - Insert links
 *
 * @example
 * ```tsx
 * <EditorFloatingMenu
 *   position={{ top: 100, left: 200 }}
 *   onAddImage={() => showImageUpload()}
 *   onAddVideo={() => showVideoEmbed()}
 *   onAddLink={() => showLinkInput()}
 *   onAddHeading={(level) => addHeading(level)}
 * />
 * ```
 */
export const EditorFloatingMenu: Component<FloatingMenuProps> = (props) => {
  const { t } = useLocalize()
  const [isOpen, setIsOpen] = createSignal(false)

  return (
    <div
      class={styles.editorFloatingMenu}
      style={{
        position: 'absolute',
        top: `${props.position.top}px`,
        left: `${props.position.left - 40}px`
      }}
    >
      <button class={styles.plusButton} onClick={() => setIsOpen(!isOpen())} title={t('Add content')}>
        <Icon name="editor-plus" />
      </button>

      <Show when={isOpen()}>
        <div class={styles.menuContent}>
          <Popover content={t('Add heading')}>
            {(setAnchorEl) => (
              <button ref={setAnchorEl} onClick={() => props.onAddHeading(1)}>
                <Icon name="editor-h1" />
              </button>
            )}
          </Popover>

          <Popover content={t('Add image')}>
            {(setAnchorEl) => (
              <button ref={setAnchorEl} onClick={props.onAddImage}>
                <Icon name="editor-image" />
              </button>
            )}
          </Popover>

          <SimpleInsertVideoForm
            onSubmit={props.onAddVideo}
            onCancel={() => setIsOpen(false)}
            execCommand={props.execCommand}
            restoreSelection={props.restoreSelection}
          >
            {(setAnchorEl) => (
              <button ref={setAnchorEl}>
                <Icon name="editor-video" />
              </button>
            )}
          </SimpleInsertVideoForm>

          <SimpleInsertLinkForm
            onSubmit={props.onAddLink}
            execCommand={props.execCommand}
            restoreSelection={props.restoreSelection}
            initialText={props.initialText}
          >
            {(setAnchorEl) => (
              <button ref={setAnchorEl}>
                <Icon name="editor-link" />
              </button>
            )}
          </SimpleInsertLinkForm>
        </div>
      </Show>
    </div>
  )
}

interface FloatingMenuProps {
  /** Position where menu should be rendered */
  position: { top: number; left: number }
  /** Called when image button clicked */
  onAddImage: () => void
  /** Called when video button clicked */
  onAddVideo: () => void
  /** Called when link button clicked */
  onAddLink: () => void
  /** Called when heading button clicked with heading level */
  onAddHeading: (level: number) => void
  /** Function to execute editor commands */
  execCommand?: (command: string, value?: string) => void
  /** Function to restore selection before executing command */
  restoreSelection?: () => boolean
  /** Currently selected text */
  initialText?: string
}
