import { Editor } from '@tiptap/core'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import clsx from 'clsx'
import { type JSX, Show, createSignal } from 'solid-js'
import { Portal } from 'solid-js/web'
import { createEditorTransaction, createTiptapEditor, useEditorIsEmpty } from 'solid-tiptap'
import { UploadModalContent } from '~/components/Upload/UploadModalContent'
import { renderUploadedImage } from '~/components/Upload/renderUploadedImage'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon/Icon'
import { Modal } from '~/components/_shared/Modal'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { base } from '~/lib/editorExtensions'
import { UploadedFile } from '~/types/upload'
import { InsertLinkForm } from './Toolbar/InsertLinkForm'
import { ToolbarControl as Control } from './Toolbar/ToolbarControl'

import styles from './MiniEditor.module.scss'

interface MiniEditorProps {
  content?: string
  onSubmit?: (content: string) => Promise<boolean> | boolean
  onCancel?: () => void
  limit?: number
  placeholder?: string
}

// MiniEditor uses onSubmit and onCancel instead of onChange

export function MiniEditor(props: MiniEditorProps): JSX.Element {
  const { t } = useLocalize()
  const { showModal } = useUI()
  const [editorElement, setEditorElement] = createSignal<HTMLDivElement>()
  const [showLinkForm, setShowLinkForm] = createSignal(false)
  const editor = createTiptapEditor(() => ({
    element: editorElement()!,
    extensions: [
      ...base,
      Placeholder.configure({ emptyNodeClass: styles.emptyNode, placeholder: props.placeholder }),
      CharacterCount.configure({ limit: props.limit })
    ],
    editorProps: {
      attributes: {
        class: styles.compactEditor
      }
    },
    content: props.content || '',
    autofocus: 'end'
  }))

  const isEmpty = useEditorIsEmpty(editor)

  const toggleLinkForm = () => {
    setShowLinkForm(!showLinkForm())
    // Если форма закрывается, возвращаем фокус редактору
    !showLinkForm() && editor()?.commands.focus()
  }

  const setLink = (url: string) => {
    url && editor()?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    !url && editor()?.chain().focus().extendMarkRange('link').unsetLink().run()
    setShowLinkForm(false)
  }

  const removeLink = () => {
    editor()?.chain().focus().unsetLink().run()
    setShowLinkForm(false)
  }

  const handleLinkButtonClick = () => {
    if (editor()?.isActive('link')) {
      const previousUrl = editor()?.getAttributes('link').href
      const url = window.prompt('URL', previousUrl)
      url && setLink(url)
    } else {
      toggleLinkForm()
    }
  }

  const handleSubmit = async () => {
    const content = editor()?.getHTML()
    if (content && props.onSubmit) {
      const success = await props.onSubmit(content)
      if (success) {
        editor()?.commands.clearContent(true)
      }
    }
  }

  const counter = createEditorTransaction(editor, (e) => e?.storage.characterCount?.characters())

  return (
    <div class={clsx(styles.MiniEditor, styles.isFocused)}>
      <div class={clsx(styles.controls)}>
        <div class={clsx(styles.actions)}>
          <Control
            key="bold"
            editor={editor()}
            onChange={() => editor()?.chain().focus().toggleBold().run()}
          >
            <Icon name="editor-bold" />
          </Control>
          <Control
            key="italic"
            editor={editor()}
            onChange={() => editor()?.chain().focus().toggleItalic().run()}
          >
            <Icon name="editor-italic" />
          </Control>
          <Control key="link" editor={editor()} onChange={handleLinkButtonClick} caption={t('Add url')}>
            <Icon name="editor-link" />
          </Control>
          <Control
            key="blockquote"
            editor={editor()}
            onChange={() => editor()?.chain().focus().toggleBlockquote().run()}
            caption={t('Add blockquote')}
          >
            <Icon name="editor-quote" />
          </Control>
          <Control
            key="image"
            editor={editor()}
            onChange={() => showModal('editorUploadImage')}
            caption={t('Add image')}
          >
            <Icon name="editor-image-dd-full" />
          </Control>
          <InsertLinkForm
            class={clsx([styles.linkInput, { [styles.linkInputactive]: showLinkForm() }])}
            editor={editor() as Editor}
            onClose={toggleLinkForm}
            onSubmit={setLink}
            onRemove={removeLink}
          />
        </div>
      </div>

      <Portal>
        <Modal variant="narrow" name="editorUploadImage">
          <UploadModalContent
            onClose={(image) => renderUploadedImage(editor() as Editor, image as UploadedFile)}
          />
        </Modal>
      </Portal>

      <div id="mini-editor" ref={setEditorElement} style={styles.minimal} />

      <div class={styles.buttons}>
        <Button
          value={t('Cancel')}
          variant="secondary"
          onClick={() => {
            editor()?.commands.clearContent()
            editor()?.commands.focus()

            props.onCancel?.()
          }}
        />
        <Button value={t('Save')} variant="primary" disabled={isEmpty()} onClick={handleSubmit} />
      </div>

      <Show when={counter() > 0}>
        <small class={styles.limit}>
          {counter()} / {props.limit || '∞'}
        </small>
      </Show>
    </div>
  )
}

export default MiniEditor
