import { clsx } from 'clsx'
import { Portal } from 'solid-js/web'
import { Component, For } from 'solid-js'

import { Icon } from '~/components/_shared/Icon'
import { DropArea } from '~/components/_shared/DropArea'
import { Modal } from '~/components/_shared/Modal'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { selectedTextToLink } from '../lib/embed'
import { SimpleInsertLinkForm } from './SimpleInsertLinkForm'
import { EditorState } from '../lib/state'
import { EditorCommand, CommandSet } from '../lib/types'

import styles from './EditorToolbar.module.scss'

/**
 * Fixed toolbar component with full editing controls
 *
 * Features:
 * - Text formatting (bold, italic)
 * - Link management
 * - Headings (H1-H3)
 * - Media embedding (images, videos)
 * - Keyboard shortcuts
 * - Modal forms for complex operations
 *
 * @example
 * ```tsx
 * <EditorToolbar
 *   state={editorState}
 *   execCommand={execCommand}
 *   handleDropFiles={(files) => uploadImages(files)}
 *   handleLinkButtonClick={() => showLinkModal()}
 *   restoreSelection={() => editor.restoreSelection()}
 * />
 * ```
 */

export type EditorToolbarProps = {
  state: EditorState
  execCommand: (command: string, value?: string) => boolean
  handleDropFiles: (files: File[]) => Promise<void>
  handleLinkButtonClick: () => void
  restoreSelection: () => void
  commands: EditorCommand[]
  config: Partial<CommandSet>
  actions: Record<string, () => void>
}
export const EditorToolbar: Component<EditorToolbarProps & {
  isVisible: boolean
}> = (props) => {
  const { t } = useLocalize()
  const { hideModal } = useUI()

  const handleLinkSubmit = (url: string) => {
    props.restoreSelection()
    const link = selectedTextToLink(url, props.state.selection.text)
    props.execCommand('insertHTML', link)
    hideModal()
  }

  return (
    <div class={
        clsx(styles.toolbar, { [styles.visible]: props.isVisible })}>
      <div class={styles.textControls}>
        <For each={props.commands}>
          {(cmd) => {
            const config = props.config[cmd]
            const act: Record<string, boolean> = {
              bold: props.state.format.text.bold,
              italic: props.state.format.text.italic,
              link: props.state.format.text.link,
              blockquote: props.state.format.block.blockquote as boolean,
              image: props.state.format.media.image as boolean,
            }
            return (
              <button
                class={styles.button}
                onClick={() => props.actions[cmd]()}
                data-active={act[cmd]}
                title={`${config?.title}${config?.shortcut ? ` (${config?.shortcut})` : ''}`}
              >
                <Icon name={config?.icon} />
              </button>
            )
          }}
        </For>
      </div>

      {/* Модалки */}
      <Portal>
        {/* Модалка для ссылок */}
        <SimpleInsertLinkForm
          onSubmit={handleLinkSubmit}
          onClose={hideModal}
          initialText={props.state.selection.text}
          restoreSelection={props.restoreSelection}
          execCommand={props.execCommand}
        >
          {(setAnchorEl) => <button ref={setAnchorEl}>{t('Add link')}</button>}
        </SimpleInsertLinkForm>

        {/* Модалка для загрузки изображений */}
        <Modal name="uploadImage" variant="narrow" onClose={hideModal}>
          <DropArea
            fileType="image"
            isMultiply={true}
            placeholder={t('Add images')}
            onUpload={props.handleDropFiles}
            description={
              <div>
                {t('You can upload up to 100 images in .jpg, .png format.')}
                <br />
                {t('Each image must be no larger than 5 MB.')}
              </div>
            }
          />
        </Modal>
      </Portal>
    </div>
  )
}
