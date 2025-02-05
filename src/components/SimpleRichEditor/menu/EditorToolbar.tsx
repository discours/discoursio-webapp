import { clsx } from 'clsx'
import { Portal } from 'solid-js/web'

import { DropArea } from '~/components/_shared/DropArea'
import { Icon } from '~/components/_shared/Icon'
import { Modal } from '~/components/_shared/Modal'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { selectedTextToLink, selectedTextToVideo } from '../lib/embed'
import { EditorState } from '../lib/state'
import { SimpleInsertLinkForm } from './SimpleInsertLinkForm'
import { SimpleInsertVideoForm } from './SimpleInsertVideoForm'

import styles from '../RichEditor.module.scss'

interface EditorToolbarProps {
  state: EditorState
  execCommand: (command: string, value?: string) => void
  handleLinkButtonClick: () => void
  handleImageUpload: (files: File[]) => void
  showVideoModal?: () => void
  handleDropFiles?: (files: File[]) => Promise<void>
  restoreSelection?: () => boolean
  saveSelection?: () => void
  getCurrentLink?: () => string | null
  isLinkActive?: () => boolean
  removeLink?: () => void
}

export const EditorToolbar = (props: EditorToolbarProps) => {
  const isMac = navigator.userAgent.includes('Mac')
  const { t } = useLocalize()
  const { hideModal, showModal } = useUI()

  const handleLinkSubmit = (url: string) => {
    if (props.restoreSelection?.()) {
      const link = selectedTextToLink(url, props.state.selection.text)
      props.execCommand('insertHTML', link)
    }
    hideModal()
  }

  const handleVideoSubmit = (url: string) => {
    if (props.restoreSelection?.()) {
      const video = selectedTextToVideo(url)
      props.execCommand('insertHTML', video)
    }
    hideModal()
  }

  return (
    <div class={styles.toolbar}>
      {/* Модалки */}
      <Portal>
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

        <Modal name="insertLink" variant="narrow" onClose={hideModal}>
          <SimpleInsertLinkForm
            onSubmit={handleLinkSubmit}
            onClose={hideModal}
            initialText={props.state.selection.text}
            restoreSelection={props.restoreSelection}
            execCommand={props.execCommand}
          />
        </Modal>

        <Modal name="insertVideo" variant="narrow" onClose={hideModal}>
          <SimpleInsertVideoForm
            onSubmit={handleVideoSubmit}
            onCancel={hideModal}
            restoreSelection={props.restoreSelection}
            execCommand={props.execCommand}
          />
        </Modal>
      </Portal>

      <div class={styles.textControls}>
        <button
          class={clsx(styles.button, { [styles.active]: props.state.format.text.bold })}
          onClick={() => props.execCommand('bold')}
          title={`${t('Bold')} (${isMac ? '⌘' : 'Ctrl'}+B)`}
        >
          <Icon name="editor-bold" />
        </button>
        <button
          class={clsx(styles.button, { [styles.active]: props.state.format.text.italic })}
          onClick={() => props.execCommand('italic')}
          title={`${t('Italic')} (${isMac ? '⌘' : 'Ctrl'}+I)`}
        >
          <Icon name="editor-italic" />
        </button>
        <button
          class={clsx(styles.button, { [styles.active]: props.state.format.text.underline })}
          onClick={() => props.execCommand('underline')}
          title={`${t('Underline')} (${isMac ? '⌘' : 'Ctrl'}+U)`}
        >
          <Icon name="editor-underline" />
        </button>
        <button
          class={clsx(styles.button, { [styles.active]: props.state.format.text.link })}
          onClick={props.handleLinkButtonClick}
          title={`${t('Add link')} (${isMac ? '⌘' : 'Ctrl'}+K)`}
        >
          <Icon name="editor-link" />
        </button>
      </div>

      <div class={styles.blockControls}>
        <button
          class={clsx(styles.button, { [styles.active]: props.state.format.block.h1 })}
          onClick={() => props.execCommand('formatBlock', '<h1>')}
        >
          H1
        </button>
        <button
          class={clsx(styles.button, { [styles.active]: props.state.format.block.h2 })}
          onClick={() => props.execCommand('formatBlock', '<h2>')}
        >
          H2
        </button>
        <button
          class={clsx(styles.button, { [styles.active]: props.state.format.block.h3 })}
          onClick={() => props.execCommand('formatBlock', '<h3>')}
        >
          H3
        </button>
      </div>

      <div class={styles.mediaControls}>
        <button class={styles.button} onClick={() => showModal('uploadImage')} title={t('Add image')}>
          <Icon name="editor-image" />
        </button>

        <button class={styles.button} onClick={() => showModal('insertVideo')} title={t('Add video')}>
          <Icon name="editor-video" />
        </button>

        <button class={styles.button} onClick={() => showModal('insertAudio')} title={t('Add audio')}>
          <Icon name="editor-audio" />
        </button>
      </div>
    </div>
  )
}
